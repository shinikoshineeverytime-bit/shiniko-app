#!/usr/bin/env python3
"""
Backend API Tests for Shiniko Stripe Connect Marketplace
Tests all payment, checkout, and job flow endpoints
"""

import requests
import json
import time
from typing import Dict, Any

# Base URL from environment
BASE_URL = "https://wash-live.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'

def print_test(name: str, passed: bool, details: str = ""):
    status = f"{Colors.GREEN}✓ PASS{Colors.END}" if passed else f"{Colors.RED}✗ FAIL{Colors.END}"
    print(f"{status} - {name}")
    if details:
        print(f"  {Colors.BLUE}→{Colors.END} {details}")
    if not passed:
        print()

def test_health_check():
    """Test 1: Health check endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        passed = response.status_code == 200 and response.json().get("status") == "healthy"
        print_test("Health Check", passed, f"Status: {response.status_code}, Response: {response.json()}")
        return passed
    except Exception as e:
        print_test("Health Check", False, f"Error: {str(e)}")
        return False

def test_payment_config():
    """Test 2: Payment config returns correct GBP pricing"""
    try:
        response = requests.get(f"{BASE_URL}/payments/config", timeout=10)
        data = response.json()
        
        expected_price = 2500  # £25.00 in pence
        expected_fee = 5  # 5%
        expected_currency = "gbp"
        
        passed = (
            response.status_code == 200 and
            data.get("service_price_pence") == expected_price and
            data.get("platform_fee_percent") == expected_fee and
            data.get("currency") == expected_currency
        )
        
        details = f"Price: £{data.get('service_price_pence', 0)/100:.2f}, Fee: {data.get('platform_fee_percent')}%, Currency: {data.get('currency')}"
        print_test("Payment Config", passed, details)
        return passed, data
    except Exception as e:
        print_test("Payment Config", False, f"Error: {str(e)}")
        return False, {}

def test_create_customer():
    """Test 3: Create customer user"""
    try:
        payload = {
            "name": "Emma Thompson",
            "role": "customer",
            "email": "emma.thompson@example.com",
            "phone": "+447700900123"
        }
        response = requests.post(f"{BASE_URL}/users", json=payload, timeout=10)
        data = response.json()
        
        passed = response.status_code == 200 and "id" in data and data.get("role") == "customer"
        print_test("Create Customer User", passed, f"Customer ID: {data.get('id')}")
        return passed, data.get("id") if passed else None
    except Exception as e:
        print_test("Create Customer User", False, f"Error: {str(e)}")
        return False, None

def test_create_washer():
    """Test 4: Create washer user"""
    try:
        payload = {
            "name": "James Wilson",
            "role": "washer",
            "email": "james.wilson@example.com",
            "phone": "+447700900456"
        }
        response = requests.post(f"{BASE_URL}/users", json=payload, timeout=10)
        data = response.json()
        
        passed = response.status_code == 200 and "id" in data and data.get("role") == "washer"
        print_test("Create Washer User", passed, f"Washer ID: {data.get('id')}")
        return passed, data.get("id") if passed else None
    except Exception as e:
        print_test("Create Washer User", False, f"Error: {str(e)}")
        return False, None

def test_checkout_session_creation(customer_id: str, customer_name: str):
    """Test 5: Create Stripe Checkout session"""
    try:
        payload = {
            "customer_id": customer_id,
            "customer_name": customer_name,
            "origin_url": "https://wash-live.preview.emergentagent.com",
            "location": {
                "latitude": 51.5074,
                "longitude": -0.1278,
                "address": "London, UK"
            },
            "vehicle": {
                "registration": "AB12CDE",
                "colour": "Black",
                "make": "BMW",
                "model": "3 Series"
            }
        }
        response = requests.post(f"{BASE_URL}/checkout/create-session", json=payload, timeout=10)
        data = response.json()
        
        passed = (
            response.status_code == 200 and
            "url" in data and
            "session_id" in data and
            data["url"].startswith("https://checkout.stripe.com")
        )
        
        details = f"Session ID: {data.get('session_id', 'N/A')[:30]}..."
        print_test("Create Checkout Session", passed, details)
        return passed, data.get("session_id") if passed else None
    except Exception as e:
        print_test("Create Checkout Session", False, f"Error: {str(e)}")
        return False, None

def test_checkout_status(session_id: str):
    """Test 6: Poll checkout session status"""
    try:
        response = requests.get(f"{BASE_URL}/checkout/status/{session_id}", timeout=10)
        data = response.json()
        
        # Check that expected fields are present
        passed = (
            response.status_code == 200 and
            "status" in data and
            "payment_status" in data and
            "amount_total" in data and
            "currency" in data
        )
        
        details = f"Status: {data.get('status')}, Payment: {data.get('payment_status')}, Amount: {data.get('amount_total')}"
        print_test("Checkout Status Polling", passed, details)
        return passed, data
    except Exception as e:
        print_test("Checkout Status Polling", False, f"Error: {str(e)}")
        return False, {}

def test_connect_account_status_nonexistent():
    """Test 7: Connect account status for non-existent user"""
    try:
        fake_user_id = "nonexistent-user-12345"
        response = requests.get(f"{BASE_URL}/connect/account-status/{fake_user_id}", timeout=10)
        data = response.json()
        
        passed = (
            response.status_code == 200 and
            data.get("has_account") == False and
            data.get("onboarding_complete") == False
        )
        
        print_test("Connect Account Status (Non-existent)", passed, f"Response: {data}")
        return passed
    except Exception as e:
        print_test("Connect Account Status (Non-existent)", False, f"Error: {str(e)}")
        return False

def test_connect_account_creation(user_id: str):
    """Test 8: Create Connect account (expected to fail with 400 - Connect not enabled)"""
    try:
        payload = {
            "user_id": user_id,
            "origin_url": "https://wash-live.preview.emergentagent.com"
        }
        response = requests.post(f"{BASE_URL}/connect/create-account", json=payload, timeout=10)
        
        # We EXPECT a 400 error because Connect is not enabled on test account
        passed = response.status_code == 400
        
        error_msg = response.json().get("detail", "") if response.status_code == 400 else ""
        details = f"Expected 400 error (Connect not enabled): {error_msg[:100]}"
        print_test("Connect Account Creation (Expected Failure)", passed, details)
        return passed
    except Exception as e:
        print_test("Connect Account Creation (Expected Failure)", False, f"Error: {str(e)}")
        return False

def test_washer_earnings_zero(user_id: str):
    """Test 9: Washer earnings for user with no earnings"""
    try:
        response = requests.get(f"{BASE_URL}/washer/{user_id}/earnings", timeout=10)
        data = response.json()
        
        passed = (
            response.status_code == 200 and
            data.get("total_earned_pence") == 0 and
            data.get("total_jobs") == 0 and
            data.get("currency") == "gbp"
        )
        
        print_test("Washer Earnings (Zero)", passed, f"Earnings: {data.get('total_earned_display', '£0.00')}, Jobs: {data.get('total_jobs', 0)}")
        return passed
    except Exception as e:
        print_test("Washer Earnings (Zero)", False, f"Error: {str(e)}")
        return False

def test_full_job_flow(customer_id: str, customer_name: str, washer_id: str, washer_name: str):
    """Test 10-13: Full job flow - create checkout, create job, accept, start, complete"""
    print(f"\n{Colors.YELLOW}=== Testing Full Job Flow ==={Colors.END}")
    
    # Step 1: Create checkout session
    try:
        payload = {
            "customer_id": customer_id,
            "customer_name": customer_name,
            "origin_url": "https://wash-live.preview.emergentagent.com",
            "location": {
                "latitude": 51.5074,
                "longitude": -0.1278,
                "address": "Westminster, London"
            },
            "vehicle": {
                "registration": "XY99ZZZ",
                "colour": "Silver",
                "make": "Mercedes",
                "model": "C-Class"
            }
        }
        response = requests.post(f"{BASE_URL}/checkout/create-session", json=payload, timeout=10)
        session_data = response.json()
        
        if response.status_code != 200 or "session_id" not in session_data:
            print_test("Job Flow - Create Checkout", False, "Failed to create checkout session")
            return False
        
        print_test("Job Flow - Create Checkout", True, f"Session: {session_data['session_id'][:30]}...")
        
        # In test mode, we can't actually complete payment, so we'll create a job directly
        # to test the job acceptance flow
        job_payload = {
            "customer_id": customer_id,
            "customer_name": customer_name,
            "location": {
                "latitude": 51.5074,
                "longitude": -0.1278,
                "address": "Westminster, London"
            },
            "vehicle": {
                "registration": "XY99ZZZ",
                "colour": "Silver",
                "make": "Mercedes",
                "model": "C-Class"
            }
        }
        
        job_response = requests.post(f"{BASE_URL}/jobs", json=job_payload, timeout=10)
        job_data = job_response.json()
        
        if job_response.status_code != 200 or "id" not in job_data:
            print_test("Job Flow - Create Job", False, "Failed to create job")
            return False
        
        job_id = job_data["id"]
        print_test("Job Flow - Create Job", True, f"Job ID: {job_id}")
        
        # Step 2: Check available jobs
        available_response = requests.get(f"{BASE_URL}/jobs/available", timeout=10)
        available_jobs = available_response.json()
        
        job_in_available = any(j["id"] == job_id for j in available_jobs)
        print_test("Job Flow - Job in Available List", job_in_available, f"Found {len(available_jobs)} available jobs")
        
        if not job_in_available:
            return False
        
        # Step 3: Washer accepts job (test mode allows without Connect account)
        accept_payload = {
            "washer_id": washer_id,
            "washer_name": washer_name
        }
        accept_response = requests.put(f"{BASE_URL}/jobs/{job_id}/accept", json=accept_payload, timeout=10)
        accept_data = accept_response.json()
        
        accept_passed = (
            accept_response.status_code == 200 and
            accept_data.get("status") == "accepted" and
            accept_data.get("washer_id") == washer_id
        )
        print_test("Job Flow - Accept Job", accept_passed, f"Status: {accept_data.get('status')}")
        
        if not accept_passed:
            return False
        
        # Step 4: Start job
        start_response = requests.put(f"{BASE_URL}/jobs/{job_id}/start", timeout=10)
        start_data = start_response.json()
        
        start_passed = (
            start_response.status_code == 200 and
            start_data.get("status") == "in_progress"
        )
        print_test("Job Flow - Start Job", start_passed, f"Status: {start_data.get('status')}")
        
        if not start_passed:
            return False
        
        # Step 5: Complete job
        complete_response = requests.put(f"{BASE_URL}/jobs/{job_id}/complete", timeout=10)
        complete_data = complete_response.json()
        
        complete_passed = (
            complete_response.status_code == 200 and
            complete_data.get("status") == "completed"
        )
        print_test("Job Flow - Complete Job", complete_passed, f"Status: {complete_data.get('status')}")
        
        return complete_passed
        
    except Exception as e:
        print_test("Job Flow - Error", False, f"Error: {str(e)}")
        return False

def test_webhook_endpoint():
    """Test 14: Webhook endpoint accepts POST requests"""
    try:
        # Send a test webhook payload
        payload = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_123456789"
                }
            }
        }
        response = requests.post(f"{BASE_URL}/webhook/stripe", json=payload, timeout=10)
        data = response.json()
        
        passed = response.status_code == 200 and data.get("received") == True
        print_test("Webhook Endpoint", passed, f"Response: {data}")
        return passed
    except Exception as e:
        print_test("Webhook Endpoint", False, f"Error: {str(e)}")
        return False

def main():
    print(f"\n{Colors.BLUE}{'='*70}{Colors.END}")
    print(f"{Colors.BLUE}Shiniko Stripe Connect Marketplace - Backend API Tests{Colors.END}")
    print(f"{Colors.BLUE}Base URL: {BASE_URL}{Colors.END}")
    print(f"{Colors.BLUE}{'='*70}{Colors.END}\n")
    
    results = []
    
    # Test 1: Health check
    results.append(test_health_check())
    
    # Test 2: Payment config
    config_passed, config_data = test_payment_config()
    results.append(config_passed)
    
    # Test 3: Create customer
    customer_passed, customer_id = test_create_customer()
    results.append(customer_passed)
    
    # Test 4: Create washer
    washer_passed, washer_id = test_create_washer()
    results.append(washer_passed)
    
    # Test 5: Create checkout session
    if customer_id:
        checkout_passed, session_id = test_checkout_session_creation(customer_id, "Emma Thompson")
        results.append(checkout_passed)
        
        # Test 6: Poll checkout status
        if session_id:
            status_passed, status_data = test_checkout_status(session_id)
            results.append(status_passed)
        else:
            results.append(False)
    else:
        results.append(False)
        results.append(False)
    
    # Test 7: Connect account status for non-existent user
    results.append(test_connect_account_status_nonexistent())
    
    # Test 8: Connect account creation (expected to fail)
    if washer_id:
        results.append(test_connect_account_creation(washer_id))
    else:
        results.append(False)
    
    # Test 9: Washer earnings (zero)
    if washer_id:
        results.append(test_washer_earnings_zero(washer_id))
    else:
        results.append(False)
    
    # Test 10-13: Full job flow
    if customer_id and washer_id:
        results.append(test_full_job_flow(customer_id, "Emma Thompson", washer_id, "James Wilson"))
    else:
        results.append(False)
    
    # Test 14: Webhook endpoint
    results.append(test_webhook_endpoint())
    
    # Summary
    print(f"\n{Colors.BLUE}{'='*70}{Colors.END}")
    passed_count = sum(results)
    total_count = len(results)
    pass_rate = (passed_count / total_count * 100) if total_count > 0 else 0
    
    if passed_count == total_count:
        print(f"{Colors.GREEN}✓ ALL TESTS PASSED: {passed_count}/{total_count} ({pass_rate:.0f}%){Colors.END}")
    else:
        print(f"{Colors.YELLOW}⚠ TESTS COMPLETED: {passed_count}/{total_count} passed ({pass_rate:.0f}%){Colors.END}")
    
    print(f"{Colors.BLUE}{'='*70}{Colors.END}\n")
    
    return passed_count == total_count

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)

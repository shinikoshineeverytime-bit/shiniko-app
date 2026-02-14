#!/usr/bin/env python3
"""
Shiniko Car Wash API Backend Test Suite
Tests the complete job lifecycle flow and all API endpoints
"""

import requests
import json
import uuid
from datetime import datetime
import time

# Use the backend URL from environment
BASE_URL = "https://quickwash-app-3.preview.emergentagent.com/api"

class ShinkoAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.session = requests.Session()
        self.test_results = []
        
    def log_test(self, test_name, success, message, response_data=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "timestamp": datetime.now().isoformat()
        }
        if response_data:
            result["response"] = response_data
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {message}")
        if not success and response_data:
            print(f"   Response: {response_data}")
    
    def test_health_check(self):
        """Test 1: Health Check"""
        try:
            response = self.session.get(f"{self.base_url}/health")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_test("Health Check", True, "API is healthy")
                    return True
                else:
                    self.log_test("Health Check", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("Health Check", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("Health Check", False, f"Connection error: {str(e)}")
            return False
    
    def test_job_creation(self):
        """Test 2: Job Creation (Customer requests wash)"""
        try:
            job_data = {
                "customer_id": "customer_john_doe_123",
                "customer_name": "John Doe",
                "location": {
                    "latitude": 40.7128,
                    "longitude": -74.0060,
                    "address": "123 Main St, New York"
                }
            }
            
            response = self.session.post(
                f"{self.base_url}/jobs",
                json=job_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if (data.get("customer_id") == job_data["customer_id"] and 
                    data.get("status") == "requested" and
                    data.get("id")):
                    self.job_id = data["id"]  # Store for later tests
                    self.log_test("Job Creation", True, f"Job created with ID: {self.job_id}")
                    return True
                else:
                    self.log_test("Job Creation", False, f"Invalid job data: {data}")
                    return False
            else:
                self.log_test("Job Creation", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("Job Creation", False, f"Error: {str(e)}")
            return False
    
    def test_get_available_jobs(self):
        """Test 3: Get Available Jobs (Washer views)"""
        try:
            response = self.session.get(f"{self.base_url}/jobs/available")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Check if our created job is in the available jobs
                    job_found = any(job.get("id") == getattr(self, 'job_id', None) for job in data)
                    if hasattr(self, 'job_id') and job_found:
                        self.log_test("Get Available Jobs", True, f"Found {len(data)} available jobs including our test job")
                    else:
                        self.log_test("Get Available Jobs", True, f"Found {len(data)} available jobs")
                    return True
                else:
                    self.log_test("Get Available Jobs", False, f"Expected list, got: {type(data)}")
                    return False
            else:
                self.log_test("Get Available Jobs", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("Get Available Jobs", False, f"Error: {str(e)}")
            return False
    
    def test_accept_job(self):
        """Test 4: Accept Job (Washer accepts)"""
        if not hasattr(self, 'job_id'):
            self.log_test("Accept Job", False, "No job ID available from previous test")
            return False
            
        try:
            accept_data = {
                "washer_id": "washer_jane_smith_456",
                "washer_name": "Jane Smith"
            }
            
            response = self.session.put(
                f"{self.base_url}/jobs/{self.job_id}/accept",
                json=accept_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if (data.get("status") == "accepted" and 
                    data.get("washer_id") == accept_data["washer_id"]):
                    self.log_test("Accept Job", True, f"Job accepted by washer: {accept_data['washer_name']}")
                    return True
                else:
                    self.log_test("Accept Job", False, f"Job not properly accepted: {data}")
                    return False
            else:
                self.log_test("Accept Job", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("Accept Job", False, f"Error: {str(e)}")
            return False
    
    def test_start_job(self):
        """Test 5: Start Job"""
        if not hasattr(self, 'job_id'):
            self.log_test("Start Job", False, "No job ID available from previous test")
            return False
            
        try:
            response = self.session.put(f"{self.base_url}/jobs/{self.job_id}/start")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "in_progress":
                    self.log_test("Start Job", True, "Job started successfully")
                    return True
                else:
                    self.log_test("Start Job", False, f"Job status not updated to in_progress: {data}")
                    return False
            else:
                self.log_test("Start Job", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("Start Job", False, f"Error: {str(e)}")
            return False
    
    def test_complete_job(self):
        """Test 6: Complete Job"""
        if not hasattr(self, 'job_id'):
            self.log_test("Complete Job", False, "No job ID available from previous test")
            return False
            
        try:
            response = self.session.put(f"{self.base_url}/jobs/{self.job_id}/complete")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "completed":
                    self.log_test("Complete Job", True, "Job completed successfully")
                    return True
                else:
                    self.log_test("Complete Job", False, f"Job status not updated to completed: {data}")
                    return False
            else:
                self.log_test("Complete Job", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("Complete Job", False, f"Error: {str(e)}")
            return False
    
    def test_cancel_job_flow(self):
        """Test 7: Cancel Job (Create new job and cancel it)"""
        try:
            # Create a new job for cancellation test
            job_data = {
                "customer_id": "customer_alice_wilson_789",
                "customer_name": "Alice Wilson",
                "location": {
                    "latitude": 40.7589,
                    "longitude": -73.9851,
                    "address": "456 Broadway, New York"
                }
            }
            
            response = self.session.post(
                f"{self.base_url}/jobs",
                json=job_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code != 200:
                self.log_test("Cancel Job Flow", False, f"Failed to create job for cancellation: {response.text}")
                return False
                
            cancel_job_id = response.json()["id"]
            
            # Now cancel the job
            response = self.session.put(f"{self.base_url}/jobs/{cancel_job_id}/cancel")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "cancelled":
                    self.log_test("Cancel Job Flow", True, "Job cancelled successfully")
                    return True
                else:
                    self.log_test("Cancel Job Flow", False, f"Job status not updated to cancelled: {data}")
                    return False
            else:
                self.log_test("Cancel Job Flow", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("Cancel Job Flow", False, f"Error: {str(e)}")
            return False
    
    def test_filter_jobs_by_customer(self):
        """Test 8: Filter Jobs by Customer ID"""
        try:
            customer_id = "customer_john_doe_123"
            response = self.session.get(f"{self.base_url}/jobs?customer_id={customer_id}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Check if all jobs belong to the specified customer
                    all_match = all(job.get("customer_id") == customer_id for job in data)
                    if all_match:
                        self.log_test("Filter Jobs by Customer", True, f"Found {len(data)} jobs for customer {customer_id}")
                        return True
                    else:
                        self.log_test("Filter Jobs by Customer", False, "Some jobs don't match the customer filter")
                        return False
                else:
                    self.log_test("Filter Jobs by Customer", False, f"Expected list, got: {type(data)}")
                    return False
            else:
                self.log_test("Filter Jobs by Customer", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("Filter Jobs by Customer", False, f"Error: {str(e)}")
            return False
    
    def test_filter_jobs_by_washer(self):
        """Test 9: Filter Jobs by Washer ID"""
        try:
            washer_id = "washer_jane_smith_456"
            response = self.session.get(f"{self.base_url}/jobs?washer_id={washer_id}")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    # Check if all jobs belong to the specified washer
                    all_match = all(job.get("washer_id") == washer_id for job in data)
                    if all_match:
                        self.log_test("Filter Jobs by Washer", True, f"Found {len(data)} jobs for washer {washer_id}")
                        return True
                    else:
                        self.log_test("Filter Jobs by Washer", False, "Some jobs don't match the washer filter")
                        return False
                else:
                    self.log_test("Filter Jobs by Washer", False, f"Expected list, got: {type(data)}")
                    return False
            else:
                self.log_test("Filter Jobs by Washer", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("Filter Jobs by Washer", False, f"Error: {str(e)}")
            return False
    
    def test_user_creation(self):
        """Test 10: User Creation and Management"""
        try:
            user_data = {
                "name": "Test Customer",
                "role": "customer",
                "location": {
                    "latitude": 40.7128,
                    "longitude": -74.0060,
                    "address": "Test Address"
                }
            }
            
            response = self.session.post(
                f"{self.base_url}/users",
                json=user_data,
                headers={"Content-Type": "application/json"}
            )
            
            if response.status_code == 200:
                data = response.json()
                if (data.get("name") == user_data["name"] and 
                    data.get("role") == user_data["role"] and
                    data.get("id")):
                    user_id = data["id"]
                    self.log_test("User Creation", True, f"User created with ID: {user_id}")
                    
                    # Test getting the user
                    get_response = self.session.get(f"{self.base_url}/users/{user_id}")
                    if get_response.status_code == 200:
                        self.log_test("Get User", True, "User retrieved successfully")
                        return True
                    else:
                        self.log_test("Get User", False, f"Failed to retrieve user: {get_response.text}")
                        return False
                else:
                    self.log_test("User Creation", False, f"Invalid user data: {data}")
                    return False
            else:
                self.log_test("User Creation", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("User Creation", False, f"Error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print(f"🚀 Starting Shiniko Car Wash API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print("=" * 60)
        
        tests = [
            self.test_health_check,
            self.test_job_creation,
            self.test_get_available_jobs,
            self.test_accept_job,
            self.test_start_job,
            self.test_complete_job,
            self.test_cancel_job_flow,
            self.test_filter_jobs_by_customer,
            self.test_filter_jobs_by_washer,
            self.test_user_creation
        ]
        
        passed = 0
        failed = 0
        
        for test in tests:
            try:
                if test():
                    passed += 1
                else:
                    failed += 1
            except Exception as e:
                print(f"❌ FAIL {test.__name__}: Unexpected error: {str(e)}")
                failed += 1
            
            # Small delay between tests
            time.sleep(0.5)
        
        print("=" * 60)
        print(f"📊 Test Results: {passed} passed, {failed} failed")
        
        if failed > 0:
            print("\n🔍 Failed Tests Details:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"   • {result['test']}: {result['message']}")
        
        return failed == 0

if __name__ == "__main__":
    tester = ShinkoAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed! Shiniko Car Wash API is working correctly.")
    else:
        print("\n⚠️  Some tests failed. Check the details above.")
        exit(1)
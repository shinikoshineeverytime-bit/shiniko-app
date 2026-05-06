from fastapi import FastAPI, APIRouter, HTTPException, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import json
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from enum import Enum
import httpx
import stripe


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Stripe configuration
stripe.api_key = os.environ.get('STRIPE_SECRET_KEY')

# Platform fee percentage (5%)
PLATFORM_FEE_PERCENT = 5
SERVICE_PRICE_CENTS = 2500  # £25.00
CURRENCY = "gbp"

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Enums
class UserRole(str, Enum):
    customer = "customer"
    washer = "washer"

class JobStatus(str, Enum):
    requested = "requested"
    accepted = "accepted"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"

# Models
class Location(BaseModel):
    latitude: float
    longitude: float
    address: Optional[str] = None

# Vehicle Model
class Vehicle(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    owner_id: str
    registration: str  # Car registration/plate number
    colour: str
    make: Optional[str] = None  # e.g., "Toyota"
    model: Optional[str] = None  # e.g., "Camry"
    year: Optional[int] = None
    photo: Optional[str] = None  # Base64 encoded photo
    notes: Optional[str] = None  # Extra info
    is_default: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class VehicleCreate(BaseModel):
    registration: str
    colour: str
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    photo: Optional[str] = None
    notes: Optional[str] = None
    is_default: bool = False

class VehicleUpdate(BaseModel):
    registration: Optional[str] = None
    colour: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
    year: Optional[int] = None
    photo: Optional[str] = None
    notes: Optional[str] = None
    is_default: Optional[bool] = None

# Vehicle info for jobs
class JobVehicleInfo(BaseModel):
    registration: str
    colour: str
    make: Optional[str] = None
    model: Optional[str] = None
    photo: Optional[str] = None
    notes: Optional[str] = None

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    role: UserRole
    phone: Optional[str] = None
    email: Optional[str] = None
    location: Optional[Location] = None
    push_token: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class UserCreate(BaseModel):
    name: str
    role: UserRole
    phone: Optional[str] = None
    email: Optional[str] = None
    location: Optional[Location] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None

class PushTokenUpdate(BaseModel):
    push_token: str

class WashJob(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    customer_name: str
    washer_id: Optional[str] = None
    washer_name: Optional[str] = None
    location: Location
    vehicle: Optional[JobVehicleInfo] = None  # Vehicle info for the job
    status: JobStatus = JobStatus.requested
    created_at: datetime = Field(default_factory=datetime.utcnow)
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    price: float = 25.00  # Fixed price for MVP

class JobCreate(BaseModel):
    customer_id: str
    customer_name: str
    location: Location
    vehicle: JobVehicleInfo  # Required vehicle info

class JobAccept(BaseModel):
    washer_id: str
    washer_name: str

# Push Notification Helper
async def send_push_notification(push_token: str, title: str, body: str, data: dict = None):
    """Send push notification via Expo Push API"""
    if not push_token or not push_token.startswith('ExponentPushToken'):
        logging.info(f"Invalid or missing push token: {push_token}")
        return False
    
    try:
        message = {
            "to": push_token,
            "sound": "default",
            "title": title,
            "body": body,
            "data": data or {},
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://exp.host/--/api/v2/push/send",
                json=message,
                headers={
                    "Accept": "application/json",
                    "Content-Type": "application/json",
                }
            )
            
            if response.status_code == 200:
                logging.info(f"Push notification sent successfully to {push_token[:20]}...")
                return True
            else:
                logging.error(f"Failed to send push notification: {response.text}")
                return False
    except Exception as e:
        logging.error(f"Error sending push notification: {e}")
        return False

async def notify_customer(customer_id: str, title: str, body: str, data: dict = None):
    """Send notification to a customer"""
    user = await db.users.find_one({"id": customer_id})
    if user and user.get("push_token"):
        await send_push_notification(user["push_token"], title, body, data)

async def notify_all_washers(title: str, body: str, data: dict = None):
    """Send notification to all active washers"""
    washers = await db.users.find({"role": "washer", "push_token": {"$ne": None}}).to_list(100)
    for washer in washers:
        if washer.get("push_token"):
            await send_push_notification(washer["push_token"], title, body, data)

# User routes
@api_router.post("/users", response_model=User)
async def create_user(user_input: UserCreate):
    user_dict = user_input.model_dump()
    user_obj = User(**user_dict)
    await db.users.insert_one(user_obj.model_dump())
    return user_obj

@api_router.get("/users/{user_id}", response_model=User)
async def get_user(user_id: str):
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user)

@api_router.put("/users/{user_id}/location")
async def update_user_location(user_id: str, location: Location):
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"location": location.model_dump()}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    return {"message": "Location updated"}

@api_router.put("/users/{user_id}/push-token")
async def update_push_token(user_id: str, token_data: PushTokenUpdate):
    """Update user's push notification token"""
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": {"push_token": token_data.push_token}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    logging.info(f"Updated push token for user {user_id}")
    return {"message": "Push token updated"}

@api_router.put("/users/{user_id}/profile")
async def update_user_profile(user_id: str, update_data: UserUpdate):
    """Update user profile information"""
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    if not update_dict:
        raise HTTPException(status_code=400, detail="No data to update")
    
    result = await db.users.update_one(
        {"id": user_id},
        {"$set": update_dict}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    updated_user = await db.users.find_one({"id": user_id})
    return User(**updated_user)

# Vehicle routes
@api_router.post("/users/{user_id}/vehicles", response_model=Vehicle)
async def add_vehicle(user_id: str, vehicle_input: VehicleCreate):
    """Add a vehicle to user's account"""
    # Check user exists
    user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # If this is the first vehicle or marked as default, set it as default
    existing_vehicles = await db.vehicles.find({"owner_id": user_id}).to_list(100)
    
    vehicle_dict = vehicle_input.model_dump()
    vehicle_dict["owner_id"] = user_id
    
    # If no existing vehicles, make this one default
    if not existing_vehicles:
        vehicle_dict["is_default"] = True
    elif vehicle_input.is_default:
        # Unset default on other vehicles
        await db.vehicles.update_many(
            {"owner_id": user_id},
            {"$set": {"is_default": False}}
        )
    
    vehicle = Vehicle(**vehicle_dict)
    await db.vehicles.insert_one(vehicle.model_dump())
    return vehicle

@api_router.get("/users/{user_id}/vehicles", response_model=List[Vehicle])
async def get_user_vehicles(user_id: str):
    """Get all vehicles for a user"""
    vehicles = await db.vehicles.find({"owner_id": user_id}).sort("created_at", -1).to_list(100)
    return [Vehicle(**v) for v in vehicles]

@api_router.get("/users/{user_id}/vehicles/default")
async def get_default_vehicle(user_id: str):
    """Get user's default vehicle"""
    vehicle = await db.vehicles.find_one({"owner_id": user_id, "is_default": True})
    if not vehicle:
        # Return first vehicle if no default set
        vehicle = await db.vehicles.find_one({"owner_id": user_id})
    if not vehicle:
        return None
    return Vehicle(**vehicle)

@api_router.put("/vehicles/{vehicle_id}", response_model=Vehicle)
async def update_vehicle(vehicle_id: str, update_data: VehicleUpdate):
    """Update a vehicle"""
    vehicle = await db.vehicles.find_one({"id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    
    # If setting as default, unset others
    if update_data.is_default:
        await db.vehicles.update_many(
            {"owner_id": vehicle["owner_id"], "id": {"$ne": vehicle_id}},
            {"$set": {"is_default": False}}
        )
    
    await db.vehicles.update_one({"id": vehicle_id}, {"$set": update_dict})
    updated = await db.vehicles.find_one({"id": vehicle_id})
    return Vehicle(**updated)

@api_router.delete("/vehicles/{vehicle_id}")
async def delete_vehicle(vehicle_id: str):
    """Delete a vehicle"""
    result = await db.vehicles.delete_one({"id": vehicle_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return {"message": "Vehicle deleted"}

@api_router.put("/vehicles/{vehicle_id}/set-default")
async def set_default_vehicle(vehicle_id: str):
    """Set a vehicle as default"""
    vehicle = await db.vehicles.find_one({"id": vehicle_id})
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Unset default on all other vehicles for this user
    await db.vehicles.update_many(
        {"owner_id": vehicle["owner_id"]},
        {"$set": {"is_default": False}}
    )
    
    # Set this one as default
    await db.vehicles.update_one({"id": vehicle_id}, {"$set": {"is_default": True}})
    return {"message": "Default vehicle updated"}

# Job routes
@api_router.post("/jobs", response_model=WashJob)
async def create_job(job_input: JobCreate):
    job_dict = job_input.model_dump()
    job_obj = WashJob(**job_dict)
    await db.jobs.insert_one(job_obj.model_dump())
    
    # Notify all washers about new job
    await notify_all_washers(
        "New Wash Request! 🚗",
        f"{job_input.customer_name} needs a car wash at {job_input.location.address or 'nearby'}",
        {"type": "new_job", "job_id": job_obj.id}
    )
    
    return job_obj

@api_router.get("/jobs", response_model=List[WashJob])
async def get_jobs(
    status: Optional[JobStatus] = None,
    customer_id: Optional[str] = None,
    washer_id: Optional[str] = None
):
    query = {}
    if status:
        query["status"] = status
    if customer_id:
        query["customer_id"] = customer_id
    if washer_id:
        query["washer_id"] = washer_id
    
    jobs = await db.jobs.find(query).sort("created_at", -1).to_list(100)
    return [WashJob(**job) for job in jobs]

@api_router.get("/jobs/available", response_model=List[WashJob])
async def get_available_jobs():
    """Get all jobs that are available for washers to accept"""
    jobs = await db.jobs.find({"status": JobStatus.requested}).sort("created_at", -1).to_list(100)
    return [WashJob(**job) for job in jobs]

@api_router.get("/jobs/{job_id}", response_model=WashJob)
async def get_job(job_id: str):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return WashJob(**job)

@api_router.put("/jobs/{job_id}/accept", response_model=WashJob)
async def accept_job(job_id: str, accept_data: JobAccept):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] != JobStatus.requested:
        raise HTTPException(status_code=400, detail="Job is not available for acceptance")
    
    # Check washer has a connected Stripe account (skip in test mode if Connect unavailable)
    washer_account = await db.washer_accounts.find_one({"user_id": accept_data.washer_id})
    stripe_key = os.environ.get('STRIPE_SECRET_KEY', '')
    is_test_mode = stripe_key.startswith('sk_test_')
    
    if not is_test_mode and (not washer_account or not washer_account.get("onboarding_complete")):
        raise HTTPException(
            status_code=400,
            detail="Please set up your payment account before accepting jobs"
        )
    
    update_data = {
        "washer_id": accept_data.washer_id,
        "washer_name": accept_data.washer_name,
        "status": JobStatus.accepted,
        "accepted_at": datetime.now(timezone.utc)
    }
    
    await db.jobs.update_one({"id": job_id}, {"$set": update_data})
    updated_job = await db.jobs.find_one({"id": job_id})
    
    # Link washer to the payment transaction for this job
    await db.payment_transactions.update_one(
        {"job_id": job_id},
        {"$set": {"washer_id": accept_data.washer_id, "updated_at": datetime.now(timezone.utc)}}
    )
    
    # Notify customer that washer accepted
    await notify_customer(
        job["customer_id"],
        "Washer on the way!",
        f"{accept_data.washer_name} accepted your request and is heading to you.",
        {"type": "job_accepted", "job_id": job_id, "washer_name": accept_data.washer_name}
    )
    
    return WashJob(**updated_job)

@api_router.put("/jobs/{job_id}/start", response_model=WashJob)
async def start_job(job_id: str):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] != JobStatus.accepted:
        raise HTTPException(status_code=400, detail="Job must be accepted before starting")
    
    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {"status": JobStatus.in_progress}}
    )
    updated_job = await db.jobs.find_one({"id": job_id})
    
    # Notify customer that wash started
    await notify_customer(
        job["customer_id"],
        "Wash Started! 💦",
        f"{job.get('washer_name', 'Your washer')} has started washing your car.",
        {"type": "job_started", "job_id": job_id}
    )
    
    return WashJob(**updated_job)

@api_router.put("/jobs/{job_id}/complete", response_model=WashJob)
async def complete_job(job_id: str):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] not in [JobStatus.accepted, JobStatus.in_progress]:
        raise HTTPException(status_code=400, detail="Job cannot be completed in current status")
    
    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {"status": JobStatus.completed, "completed_at": datetime.now(timezone.utc)}}
    )
    
    # Create automatic transfer to washer's connected account
    if job.get("washer_id"):
        washer_account = await db.washer_accounts.find_one({"user_id": job["washer_id"]})
        if washer_account and washer_account.get("onboarding_complete"):
            try:
                payment_tx = await db.payment_transactions.find_one({
                    "job_id": job_id,
                    "payment_status": "paid",
                    "transfer_id": None,
                })
                if payment_tx:
                    transfer = stripe.Transfer.create(
                        amount=payment_tx["washer_payout"],
                        currency=CURRENCY,
                        destination=washer_account["stripe_account_id"],
                        transfer_group=f"job_{job_id}",
                        metadata={"job_id": job_id, "washer_id": job["washer_id"]},
                    )
                    await db.payment_transactions.update_one(
                        {"id": payment_tx["id"]},
                        {"$set": {
                            "transfer_id": transfer.id,
                            "washer_id": job["washer_id"],
                            "updated_at": datetime.now(timezone.utc),
                        }}
                    )
                    logger.info(f"Transfer {transfer.id} created for washer {job['washer_id']}")
            except stripe.error.StripeError as e:
                logger.error(f"Transfer error for job {job_id}: {e}")
    
    updated_job = await db.jobs.find_one({"id": job_id})
    
    # Notify customer that wash is complete
    await notify_customer(
        job["customer_id"],
        "Wash Complete!",
        "Your car is now sparkling clean! Thank you for using Shiniko.",
        {"type": "job_completed", "job_id": job_id}
    )
    
    return WashJob(**updated_job)

@api_router.put("/jobs/{job_id}/cancel", response_model=WashJob)
async def cancel_job(job_id: str):
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    if job["status"] in [JobStatus.completed, JobStatus.cancelled]:
        raise HTTPException(status_code=400, detail="Job cannot be cancelled")
    
    await db.jobs.update_one(
        {"id": job_id},
        {"$set": {"status": JobStatus.cancelled}}
    )
    updated_job = await db.jobs.find_one({"id": job_id})
    
    # If washer was assigned, notify them
    if job.get("washer_id"):
        washer = await db.users.find_one({"id": job["washer_id"]})
        if washer and washer.get("push_token"):
            await send_push_notification(
                washer["push_token"],
                "Job Cancelled",
                f"The customer cancelled the wash request.",
                {"type": "job_cancelled", "job_id": job_id}
            )
    
    return WashJob(**updated_job)

# ==================== CAR WASH LOCATIONS ====================

class ServiceType(str, Enum):
    basic_wash = "basic_wash"
    premium_wash = "premium_wash"
    full_detail = "full_detail"
    interior_clean = "interior_clean"
    wax_polish = "wax_polish"
    tire_shine = "tire_shine"
    engine_clean = "engine_clean"

class DayHours(BaseModel):
    open: str  # "09:00"
    close: str  # "18:00"
    is_closed: bool = False

class OperatingHours(BaseModel):
    monday: Optional[DayHours] = None
    tuesday: Optional[DayHours] = None
    wednesday: Optional[DayHours] = None
    thursday: Optional[DayHours] = None
    friday: Optional[DayHours] = None
    saturday: Optional[DayHours] = None
    sunday: Optional[DayHours] = None

class ServiceOffered(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    duration_minutes: Optional[int] = None

class CarWashLocation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    location: Location
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    operating_hours: Optional[OperatingHours] = None
    services: List[ServiceOffered] = []
    amenities: List[str] = []  # ["WiFi", "Waiting Area", "Coffee", "Air Conditioning"]
    payment_methods: List[str] = []  # ["Cash", "Card", "Apple Pay"]
    images: List[str] = []  # Base64 encoded images
    logo: Optional[str] = None  # Base64 encoded logo
    rating: float = 0.0
    review_count: int = 0
    owner_id: Optional[str] = None
    is_verified: bool = False
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CarWashLocationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    location: Location
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    operating_hours: Optional[OperatingHours] = None
    services: List[ServiceOffered] = []
    amenities: List[str] = []
    payment_methods: List[str] = []
    images: List[str] = []
    logo: Optional[str] = None
    owner_id: Optional[str] = None

class CarWashLocationUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[Location] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    operating_hours: Optional[OperatingHours] = None
    services: Optional[List[ServiceOffered]] = None
    amenities: Optional[List[str]] = None
    payment_methods: Optional[List[str]] = None
    images: Optional[List[str]] = None
    logo: Optional[str] = None
    is_active: Optional[bool] = None

# Car Wash Location Routes
@api_router.post("/locations", response_model=CarWashLocation)
async def create_location(location_input: CarWashLocationCreate):
    """Create a new car wash location listing"""
    location_dict = location_input.model_dump()
    location_obj = CarWashLocation(**location_dict)
    await db.locations.insert_one(location_obj.model_dump())
    return location_obj

@api_router.get("/locations", response_model=List[CarWashLocation])
async def get_locations(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: float = 50.0,
    is_active: bool = True
):
    """Get all car wash locations, optionally filtered by proximity"""
    query = {"is_active": is_active}
    locations = await db.locations.find(query).sort("created_at", -1).to_list(100)
    
    result = [CarWashLocation(**loc) for loc in locations]
    
    # If coordinates provided, sort by distance
    if lat is not None and lng is not None:
        def calc_distance(loc):
            from math import radians, sin, cos, sqrt, atan2
            R = 6371  # Earth's radius in km
            lat1, lon1 = radians(lat), radians(lng)
            lat2 = radians(loc.location.latitude)
            lon2 = radians(loc.location.longitude)
            dlat = lat2 - lat1
            dlon = lon2 - lon1
            a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
            c = 2 * atan2(sqrt(a), sqrt(1-a))
            return R * c
        
        # Filter by radius and sort by distance
        result = [loc for loc in result if calc_distance(loc) <= radius_km]
        result.sort(key=calc_distance)
    
    return result

@api_router.get("/locations/{location_id}", response_model=CarWashLocation)
async def get_location(location_id: str):
    """Get a specific car wash location by ID"""
    location = await db.locations.find_one({"id": location_id})
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return CarWashLocation(**location)

@api_router.put("/locations/{location_id}", response_model=CarWashLocation)
async def update_location(location_id: str, update_data: CarWashLocationUpdate):
    """Update a car wash location"""
    location = await db.locations.find_one({"id": location_id})
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    
    update_dict = {k: v for k, v in update_data.model_dump().items() if v is not None}
    update_dict["updated_at"] = datetime.utcnow()
    
    await db.locations.update_one({"id": location_id}, {"$set": update_dict})
    updated = await db.locations.find_one({"id": location_id})
    return CarWashLocation(**updated)

@api_router.delete("/locations/{location_id}")
async def delete_location(location_id: str):
    """Delete (deactivate) a car wash location"""
    result = await db.locations.update_one(
        {"id": location_id},
        {"$set": {"is_active": False, "updated_at": datetime.utcnow()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Location not found")
    return {"message": "Location deleted"}

@api_router.get("/locations/{location_id}/reviews")
async def get_location_reviews(location_id: str):
    """Get reviews for a specific location"""
    reviews = await db.location_reviews.find({"location_id": location_id}).sort("created_at", -1).to_list(50)
    return reviews

class LocationReview(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    location_id: str
    user_id: str
    user_name: str
    rating: int  # 1-5
    comment: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class LocationReviewCreate(BaseModel):
    user_id: str
    user_name: str
    rating: int
    comment: Optional[str] = None

@api_router.post("/locations/{location_id}/reviews")
async def add_location_review(location_id: str, review_input: LocationReviewCreate):
    """Add a review for a car wash location"""
    location = await db.locations.find_one({"id": location_id})
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    
    review = LocationReview(location_id=location_id, **review_input.model_dump())
    await db.location_reviews.insert_one(review.model_dump())
    
    # Update location rating
    all_reviews = await db.location_reviews.find({"location_id": location_id}).to_list(1000)
    if all_reviews:
        avg_rating = sum(r["rating"] for r in all_reviews) / len(all_reviews)
        await db.locations.update_one(
            {"id": location_id},
            {"$set": {"rating": round(avg_rating, 1), "review_count": len(all_reviews)}}
        )
    
    return review

# ==================== END CAR WASH LOCATIONS ====================

# ==================== CHAT / MESSAGING ====================

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    job_id: str
    sender_id: str
    sender_name: str
    sender_role: str  # "customer" or "washer"
    message: str
    is_quick_action: bool = False
    created_at: datetime = Field(default_factory=datetime.utcnow)

class ChatMessageCreate(BaseModel):
    sender_id: str
    sender_name: str
    sender_role: str
    message: str
    is_quick_action: bool = False

@api_router.get("/jobs/{job_id}/messages", response_model=List[ChatMessage])
async def get_job_messages(job_id: str):
    """Get all messages for a specific job"""
    messages = await db.messages.find({"job_id": job_id}).sort("created_at", 1).to_list(100)
    return [ChatMessage(**msg) for msg in messages]

@api_router.post("/jobs/{job_id}/messages", response_model=ChatMessage)
async def send_message(job_id: str, message_input: ChatMessageCreate):
    """Send a message in a job chat"""
    job = await db.jobs.find_one({"id": job_id})
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    
    message = ChatMessage(job_id=job_id, **message_input.model_dump())
    await db.messages.insert_one(message.model_dump())
    
    # Send push notification to the other party
    if message_input.sender_role == "customer":
        # Notify washer
        if job.get("washer_id"):
            washer = await db.users.find_one({"id": job["washer_id"]})
            if washer and washer.get("push_token"):
                await send_push_notification(
                    washer["push_token"],
                    f"Message from {message_input.sender_name}",
                    message_input.message[:100],
                    {"type": "chat_message", "job_id": job_id}
                )
    else:
        # Notify customer
        customer = await db.users.find_one({"id": job["customer_id"]})
        if customer and customer.get("push_token"):
            await send_push_notification(
                customer["push_token"],
                f"Message from {message_input.sender_name}",
                message_input.message[:100],
                {"type": "chat_message", "job_id": job_id}
            )
    
    return message

# Quick action messages
QUICK_ACTIONS = {
    "customer": [
        {"id": "here", "message": "I'm at the location"},
        {"id": "car_desc", "message": "My car is parked outside"},
        {"id": "running_late", "message": "Running a few minutes late"},
        {"id": "where_are_you", "message": "Where are you?"},
        {"id": "thanks", "message": "Thank you!"},
    ],
    "washer": [
        {"id": "on_way", "message": "On my way!"},
        {"id": "arriving", "message": "Arriving in 5 minutes"},
        {"id": "here", "message": "I'm here"},
        {"id": "cant_find", "message": "I can't find your car, can you help?"},
        {"id": "starting", "message": "Starting the wash now"},
        {"id": "almost_done", "message": "Almost done!"},
        {"id": "completed", "message": "All done! Your car is sparkling clean ✨"},
    ]
}

@api_router.get("/chat/quick-actions")
async def get_quick_actions(role: str = "customer"):
    """Get quick action messages for a role"""
    return QUICK_ACTIONS.get(role, QUICK_ACTIONS["customer"])

# ==================== END CHAT / MESSAGING ====================

# ==================== STRIPE CONNECT (MARKETPLACE) ====================

class ConnectAccountRequest(BaseModel):
    user_id: str
    origin_url: str

class OnboardingLinkRequest(BaseModel):
    user_id: str
    origin_url: str

@api_router.post("/connect/create-account")
async def create_connect_account(request: ConnectAccountRequest):
    """Create a Stripe Express connected account for a washer"""
    user = await db.users.find_one({"id": request.user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.washer_accounts.find_one({"user_id": request.user_id})
    if existing:
        # Account exists, generate fresh onboarding link
        try:
            account_link = stripe.AccountLink.create(
                account=existing["stripe_account_id"],
                refresh_url=f"{request.origin_url}/washer",
                return_url=f"{request.origin_url}/washer?onboarding=complete",
                type='account_onboarding',
            )
            return {
                "stripe_account_id": existing["stripe_account_id"],
                "onboarding_url": account_link.url,
                "already_exists": True,
            }
        except stripe.error.StripeError as e:
            raise HTTPException(status_code=400, detail=str(e))

    try:
        account = stripe.Account.create(
            type='express',
            country='GB',
            capabilities={
                'card_payments': {'requested': True},
                'transfers': {'requested': True},
            },
            metadata={'user_id': request.user_id, 'platform': 'shiniko'},
        )

        await db.washer_accounts.insert_one({
            "user_id": request.user_id,
            "stripe_account_id": account.id,
            "onboarding_complete": False,
            "created_at": datetime.now(timezone.utc),
        })

        account_link = stripe.AccountLink.create(
            account=account.id,
            refresh_url=f"{request.origin_url}/washer",
            return_url=f"{request.origin_url}/washer?onboarding=complete",
            type='account_onboarding',
        )

        return {
            "stripe_account_id": account.id,
            "onboarding_url": account_link.url,
            "already_exists": False,
        }
    except stripe.error.StripeError as e:
        logger.error(f"Stripe Connect error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/connect/onboarding-link")
async def get_onboarding_link(request: OnboardingLinkRequest):
    """Get a fresh onboarding link for a washer"""
    washer_account = await db.washer_accounts.find_one({"user_id": request.user_id})
    if not washer_account:
        raise HTTPException(status_code=404, detail="No connected account found. Create one first.")

    try:
        account_link = stripe.AccountLink.create(
            account=washer_account["stripe_account_id"],
            refresh_url=f"{request.origin_url}/washer",
            return_url=f"{request.origin_url}/washer?onboarding=complete",
            type='account_onboarding',
        )
        return {"onboarding_url": account_link.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/connect/account-status/{user_id}")
async def get_connect_account_status(user_id: str):
    """Check if a washer's connected account is ready for payouts"""
    washer_account = await db.washer_accounts.find_one({"user_id": user_id})
    if not washer_account:
        return {"has_account": False, "onboarding_complete": False}

    try:
        account = stripe.Account.retrieve(washer_account["stripe_account_id"])
        is_complete = account.charges_enabled and account.payouts_enabled

        if is_complete and not washer_account.get("onboarding_complete"):
            await db.washer_accounts.update_one(
                {"user_id": user_id},
                {"$set": {"onboarding_complete": True}}
            )

        return {
            "has_account": True,
            "stripe_account_id": washer_account["stripe_account_id"],
            "onboarding_complete": is_complete,
            "charges_enabled": account.charges_enabled,
            "payouts_enabled": account.payouts_enabled,
        }
    except stripe.error.StripeError as e:
        return {"has_account": True, "onboarding_complete": False, "error": str(e)}

@api_router.get("/connect/dashboard-link/{user_id}")
async def get_dashboard_link(user_id: str):
    """Get link to washer's Stripe Express dashboard to view payouts"""
    washer_account = await db.washer_accounts.find_one({"user_id": user_id})
    if not washer_account:
        raise HTTPException(status_code=404, detail="No connected account found")

    try:
        login_link = stripe.Account.create_login_link(washer_account["stripe_account_id"])
        return {"dashboard_url": login_link.url}
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/washer/{user_id}/earnings")
async def get_washer_earnings(user_id: str):
    """Get earnings summary for a washer"""
    transactions = await db.payment_transactions.find({
        "washer_id": user_id,
        "payment_status": "paid",
        "transfer_id": {"$ne": None},
    }).to_list(1000)

    total_earned = sum(t.get("washer_payout", 0) for t in transactions)
    total_jobs = len(transactions)

    return {
        "total_earned_pence": total_earned,
        "total_earned_display": f"\u00a3{total_earned / 100:.2f}",
        "total_jobs": total_jobs,
        "currency": "gbp",
    }

# ==================== CHECKOUT / PAYMENTS ====================

class CheckoutRequest(BaseModel):
    customer_id: str
    customer_name: str
    origin_url: str
    location: Location
    vehicle: JobVehicleInfo

@api_router.post("/checkout/create-session")
async def create_checkout_session(request: CheckoutRequest):
    """Create a Stripe Checkout session for car wash payment"""
    try:
        platform_fee = int(SERVICE_PRICE_CENTS * PLATFORM_FEE_PERCENT / 100)
        washer_payout = SERVICE_PRICE_CENTS - platform_fee

        success_url = f"{request.origin_url}/payment/success?session_id={{CHECKOUT_SESSION_ID}}"
        cancel_url = f"{request.origin_url}/customer"

        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': CURRENCY,
                    'product_data': {
                        'name': 'Exterior Car Wash',
                        'description': 'Full exterior hand wash & dry',
                    },
                    'unit_amount': SERVICE_PRICE_CENTS,
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=success_url,
            cancel_url=cancel_url,
            metadata={
                'customer_id': request.customer_id,
                'customer_name': request.customer_name,
                'latitude': str(request.location.latitude),
                'longitude': str(request.location.longitude),
                'address': request.location.address or '',
                'vehicle_registration': request.vehicle.registration,
                'vehicle_colour': request.vehicle.colour,
                'platform_fee': str(platform_fee),
                'washer_payout': str(washer_payout),
            },
        )

        # Create payment transaction record
        await db.payment_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "session_id": session.id,
            "customer_id": request.customer_id,
            "job_id": None,
            "amount": SERVICE_PRICE_CENTS,
            "currency": CURRENCY,
            "platform_fee": platform_fee,
            "washer_payout": washer_payout,
            "payment_status": "pending",
            "transfer_id": None,
            "washer_id": None,
            "metadata": {
                'customer_name': request.customer_name,
                'vehicle_registration': request.vehicle.registration,
                'vehicle_colour': request.vehicle.colour,
                'location_address': request.location.address or '',
            },
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc),
        })

        return {"url": session.url, "session_id": session.id}

    except stripe.error.StripeError as e:
        logger.error(f"Stripe checkout error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str):
    """Poll checkout session status. Creates job on successful payment."""
    try:
        session = stripe.checkout.Session.retrieve(session_id)

        existing_tx = await db.payment_transactions.find_one({"session_id": session_id})

        if existing_tx:
            new_status = "paid" if session.payment_status == "paid" else session.payment_status
            if existing_tx.get("payment_status") != new_status:
                await db.payment_transactions.update_one(
                    {"session_id": session_id},
                    {"$set": {"payment_status": new_status, "updated_at": datetime.now(timezone.utc)}}
                )

        # If paid and no job created yet, create the job
        job = None
        if session.payment_status == "paid" and existing_tx and not existing_tx.get("job_id"):
            meta = session.metadata
            job_obj = WashJob(
                customer_id=meta.get("customer_id", ""),
                customer_name=meta.get("customer_name", ""),
                location=Location(
                    latitude=float(meta.get("latitude", 0)),
                    longitude=float(meta.get("longitude", 0)),
                    address=meta.get("address") or None,
                ),
                vehicle=JobVehicleInfo(
                    registration=meta.get("vehicle_registration", ""),
                    colour=meta.get("vehicle_colour", ""),
                ),
            )
            await db.jobs.insert_one(job_obj.model_dump())

            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"job_id": job_obj.id, "updated_at": datetime.now(timezone.utc)}}
            )

            await notify_all_washers(
                "New Wash Request!",
                f"{meta.get('customer_name', 'Customer')} needs a car wash",
                {"type": "new_job", "job_id": job_obj.id}
            )

            job = {
                "id": job_obj.id,
                "customer_id": job_obj.customer_id,
                "customer_name": job_obj.customer_name,
                "status": job_obj.status,
            }
        elif existing_tx and existing_tx.get("job_id"):
            # Job already created from a previous poll
            existing_job = await db.jobs.find_one({"id": existing_tx["job_id"]}, {"_id": 0})
            if existing_job:
                job = {"id": existing_job["id"], "status": existing_job["status"]}

        return {
            "status": session.status,
            "payment_status": session.payment_status,
            "amount_total": session.amount_total,
            "currency": session.currency,
            "job": job,
        }

    except stripe.error.StripeError as e:
        logger.error(f"Stripe status error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Handle Stripe webhooks for payment events"""
    body = await request.body()
    try:
        event = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid payload")

    event_type = event.get("type", "")

    if event_type == "checkout.session.completed":
        session_data = event.get("data", {}).get("object", {})
        session_id = session_data.get("id")
        if session_id:
            await db.payment_transactions.update_one(
                {"session_id": session_id},
                {"$set": {"payment_status": "paid", "updated_at": datetime.now(timezone.utc)}}
            )

    return {"received": True}

@api_router.get("/payments/config")
async def get_payment_config():
    """Get pricing info for the service"""
    return {
        "service_price_pence": SERVICE_PRICE_CENTS,
        "service_price_display": f"\u00a3{SERVICE_PRICE_CENTS / 100:.2f}",
        "platform_fee_percent": PLATFORM_FEE_PERCENT,
        "currency": CURRENCY,
    }

# ==================== END PAYMENTS ====================

@api_router.get("/")
async def root():
    return {"message": "Shiniko Car Wash API", "version": "1.0.0"}

# Health check
@api_router.get("/health")
async def health_check():
    return {"status": "healthy"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

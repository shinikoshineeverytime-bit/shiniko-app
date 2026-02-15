from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
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
STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY')

# Platform fee percentage (5%)
PLATFORM_FEE_PERCENT = 5
SERVICE_PRICE_CENTS = 2500  # $25.00

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
    
    update_data = {
        "washer_id": accept_data.washer_id,
        "washer_name": accept_data.washer_name,
        "status": JobStatus.accepted,
        "accepted_at": datetime.utcnow()
    }
    
    await db.jobs.update_one({"id": job_id}, {"$set": update_data})
    updated_job = await db.jobs.find_one({"id": job_id})
    
    # Notify customer that washer accepted
    await notify_customer(
        job["customer_id"],
        "Washer on the way! 🚙",
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
        {"$set": {"status": JobStatus.completed, "completed_at": datetime.utcnow()}}
    )
    updated_job = await db.jobs.find_one({"id": job_id})
    
    # Notify customer that wash is complete
    await notify_customer(
        job["customer_id"],
        "Wash Complete! ✨",
        f"Your car is now sparkling clean! Thank you for using Shiniko.",
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

# ==================== PAYMENTS (STRIPE) ====================

class PaymentStatus(str, Enum):
    pending = "pending"
    succeeded = "succeeded"
    failed = "failed"
    refunded = "refunded"

class Payment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    stripe_payment_intent_id: str
    job_id: Optional[str] = None
    customer_id: str
    washer_id: Optional[str] = None
    amount_cents: int  # Total amount in cents
    platform_fee_cents: int  # 5% platform fee
    washer_payout_cents: int  # 95% for washer
    currency: str = "usd"
    status: PaymentStatus = PaymentStatus.pending
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

class CreatePaymentIntentRequest(BaseModel):
    customer_id: str
    washer_id: Optional[str] = None
    job_id: Optional[str] = None

class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount_cents: int
    platform_fee_cents: int
    washer_payout_cents: int
    publishable_key: str

@api_router.post("/payments/create-intent", response_model=PaymentIntentResponse)
async def create_payment_intent(request: CreatePaymentIntentRequest):
    """
    Create a Stripe PaymentIntent for a car wash service.
    Price: $25.00 (2500 cents)
    Platform fee: 5% ($1.25)
    Washer gets: 95% ($23.75)
    """
    try:
        # Calculate fee split
        amount_cents = SERVICE_PRICE_CENTS
        platform_fee_cents = int(amount_cents * PLATFORM_FEE_PERCENT / 100)
        washer_payout_cents = amount_cents - platform_fee_cents
        
        # Create PaymentIntent with Stripe
        payment_intent = stripe.PaymentIntent.create(
            amount=amount_cents,
            currency="usd",
            payment_method_types=["card"],
            metadata={
                "customer_id": request.customer_id,
                "washer_id": request.washer_id or "",
                "job_id": request.job_id or "",
                "platform_fee_cents": str(platform_fee_cents),
                "washer_payout_cents": str(washer_payout_cents),
            },
        )
        
        # Store payment record in MongoDB
        payment_doc = {
            "id": str(uuid.uuid4()),
            "stripe_payment_intent_id": payment_intent.id,
            "job_id": request.job_id,
            "customer_id": request.customer_id,
            "washer_id": request.washer_id,
            "amount_cents": amount_cents,
            "platform_fee_cents": platform_fee_cents,
            "washer_payout_cents": washer_payout_cents,
            "currency": "usd",
            "status": "pending",
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
        }
        
        await db.payments.insert_one(payment_doc)
        
        return PaymentIntentResponse(
            client_secret=payment_intent.client_secret,
            payment_intent_id=payment_intent.id,
            amount_cents=amount_cents,
            platform_fee_cents=platform_fee_cents,
            washer_payout_cents=washer_payout_cents,
            publishable_key=STRIPE_PUBLISHABLE_KEY,
        )
    
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating payment intent: {e}")
        raise HTTPException(status_code=500, detail="Failed to create payment intent")

@api_router.post("/payments/confirm/{payment_intent_id}")
async def confirm_payment(payment_intent_id: str):
    """
    Confirm payment status after completion.
    Called by frontend after successful PaymentSheet completion.
    """
    try:
        # Retrieve the payment intent from Stripe
        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        # Update payment record in MongoDB
        await db.payments.update_one(
            {"stripe_payment_intent_id": payment_intent_id},
            {
                "$set": {
                    "status": payment_intent.status,
                    "updated_at": datetime.utcnow(),
                }
            }
        )
        
        # Get the payment record
        payment = await db.payments.find_one({"stripe_payment_intent_id": payment_intent_id})
        
        if payment_intent.status == "succeeded":
            # If there's a job associated, update its payment status
            if payment and payment.get("job_id"):
                await db.wash_jobs.update_one(
                    {"id": payment["job_id"]},
                    {"$set": {"payment_status": "paid", "updated_at": datetime.utcnow()}}
                )
            
            return {
                "status": "succeeded",
                "message": "Payment successful!",
                "amount_cents": payment["amount_cents"] if payment else SERVICE_PRICE_CENTS,
            }
        else:
            return {
                "status": payment_intent.status,
                "message": f"Payment status: {payment_intent.status}",
            }
    
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error confirming payment: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error confirming payment: {e}")
        raise HTTPException(status_code=500, detail="Failed to confirm payment")

@api_router.get("/payments/status/{payment_intent_id}")
async def get_payment_status(payment_intent_id: str):
    """Get the current status of a payment"""
    try:
        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
        
        payment = await db.payments.find_one({"stripe_payment_intent_id": payment_intent_id})
        
        return {
            "status": payment_intent.status,
            "amount_cents": payment_intent.amount,
            "currency": payment_intent.currency,
            "platform_fee_cents": payment["platform_fee_cents"] if payment else 0,
            "washer_payout_cents": payment["washer_payout_cents"] if payment else 0,
        }
    except stripe.error.StripeError as e:
        raise HTTPException(status_code=400, detail=str(e))

@api_router.get("/payments/config")
async def get_payment_config():
    """Get Stripe publishable key and pricing info"""
    return {
        "publishable_key": STRIPE_PUBLISHABLE_KEY,
        "service_price_cents": SERVICE_PRICE_CENTS,
        "platform_fee_percent": PLATFORM_FEE_PERCENT,
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

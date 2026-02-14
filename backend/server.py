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


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

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

class User(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    role: UserRole
    location: Optional[Location] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    is_active: bool = True

class UserCreate(BaseModel):
    name: str
    role: UserRole
    location: Optional[Location] = None

class WashJob(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    customer_id: str
    customer_name: str
    washer_id: Optional[str] = None
    washer_name: Optional[str] = None
    location: Location
    status: JobStatus = JobStatus.requested
    created_at: datetime = Field(default_factory=datetime.utcnow)
    accepted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    price: float = 25.00  # Fixed price for MVP

class JobCreate(BaseModel):
    customer_id: str
    customer_name: str
    location: Location

class JobAccept(BaseModel):
    washer_id: str
    washer_name: str

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

# Job routes
@api_router.post("/jobs", response_model=WashJob)
async def create_job(job_input: JobCreate):
    job_dict = job_input.model_dump()
    job_obj = WashJob(**job_dict)
    await db.jobs.insert_one(job_obj.model_dump())
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
    return WashJob(**updated_job)

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

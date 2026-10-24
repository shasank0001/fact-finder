from .job_det import FakeInternshipDetectorAPI, CompanyInfoRequest
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

# Function to analyze a job/company offer using the detector

def analyze_job_offer(company_details: dict):
    # Convert dict to CompanyInfoRequest
    company_info = CompanyInfoRequest(**company_details)
    detector = FakeInternshipDetectorAPI()
    result = detector.analyze_company(company_info)
    return result

# Example usage
def main():
    example_details = {
        "name": "Example Corp",
        "website": "https://example.com",
        "email": "hr@example.com",
        "phone": "+1234567890",
        "address": "123 Main St, City, Country",
        "job_description": "Work from home, easy money, no experience required!",
        "salary_offered": "$1000/week",
        "requirements": "None",
        "contact_person": "John Doe",
        "company_size": "10-50",
        "industry": "IT",
        "social_media": {"linkedin": "https://linkedin.com/company/example-corp"},
        "job_post_date": datetime.now().strftime('%Y-%m-%d')
    }
    result = analyze_job_offer(example_details)
    print(result.json(indent=2, sort_keys=True, default=str))

if __name__ == "__main__":
    main()


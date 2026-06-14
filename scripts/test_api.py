import requests
import time

base_url = "http://localhost:8000/api"

def test_add_module():
    url = f"{base_url}/admin/modules"
    ts = int(time.time())
    payload = {
        "name": f"Module {ts}",
        "code": f"CODE{ts}",
        "description": "A test module description"
    }

    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        print(f"Response Body: {response.text}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    test_add_module()

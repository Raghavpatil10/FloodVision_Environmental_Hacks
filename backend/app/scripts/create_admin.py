import argparse
import sys
import getpass
import os

# Add parent directory to path so script can run from project root or backend folder
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.services.auth_service import auth_service
from app.repositories.user_repo import user_repo

def main():
    parser = argparse.ArgumentParser(description="Securely provision an Admin account for FloodVision.")
    parser.add_argument("--name", type=str, help="Full Name of the Admin Officer")
    parser.add_argument("--email", type=str, help="Admin Email Address")
    parser.add_argument("--password", type=str, help="Admin Password (min 8 characters)")

    args = parser.parse_args()

    name = args.name
    email = args.email
    password = args.password

    print("\n========================================================")
    print("[ADMIN] FloodVision - Secure Admin Account Provisioning Tool")
    print("========================================================\n")

    if not name:
        name = input("Enter Admin Full Name: ").strip()
    if not email:
        email = input("Enter Admin Email Address: ").strip().lower()
    if not password:
        password = getpass.getpass("Enter Admin Password (min 8 chars): ")
        confirm = getpass.getpass("Confirm Admin Password: ")
        if password != confirm:
            print("[ERROR] Passwords do not match.")
            sys.exit(1)

    if not name or not email or not password:
        print("[ERROR] Name, email, and password are required.")
        sys.exit(1)

    if len(password) < 8:
        print("[ERROR] Password must be at least 8 characters long.")
        sys.exit(1)

    try:
        admin_user = auth_service.create_admin_user(
            name=name,
            email=email,
            password=password
        )
        print("\n[SUCCESS] Admin Account Successfully Provisioned!")
        print(f"   - Name:  {admin_user['name']}")
        print(f"   - Email: {admin_user['email']}")
        print(f"   - Role:  {admin_user['role'].upper()}")
        print(f"   - ID:    {admin_user['id']}")
        print("\nYou can now sign in at http://localhost:5173/login\n")
    except Exception as e:
        print(f"\n[ERROR] Failed to provision admin: {e}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()

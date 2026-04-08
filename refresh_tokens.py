"""
Get a NEW Strava token with the RIGHT permissions for reading activities
"""

import webbrowser
import requests
from http.server import HTTPServer, BaseHTTPRequestHandler
import urllib.parse
import json
import threading
import time

class AuthHandler(BaseHTTPRequestHandler):
    """Handles the OAuth callback"""
    def do_GET(self):
        query = urllib.parse.urlparse(self.path).query
        params = urllib.parse.parse_qs(query)
        
        if 'code' in params:
            self.server.auth_code = params['code'][0]
            self.server.scope = params.get('scope', [''])[0]
            
            # Send success response
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            
            # Check if we got the right permissions
            if 'activity:read' in self.server.scope or 'read_all' in self.server.scope:
                status = "SUCCESS! Got activity permissions!"
                color = "#44ff44"
            else:
                status = "⚠️ Warning: Activity permissions may be missing"
                color = "#ffaa00"
            
            self.wfile.write(f"""
                <html>
                <head>
                    <style>
                        body {{ 
                            font-family: Arial; 
                            background: #1a1a1a; 
                            color: white;
                            padding: 50px; 
                            text-align: center; 
                        }}
                        h1 {{ color: {color}; }}
                        .scope {{ 
                            background: #333; 
                            padding: 10px; 
                            border-radius: 5px; 
                            margin: 20px;
                            color: #00d4ff;
                        }}
                    </style>
                </head>
                <body>
                    <h1>{status}</h1>
                    <div class="scope">Granted permissions: {self.server.scope}</div>
                    <p>You can close this window and check your terminal for the access token.</p>
                </body>
                </html>
            """.encode())
        elif 'error' in params:
            self.server.auth_code = None
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(b"""
                <html><body style="font-family: Arial; padding: 50px;">
                <h1 style="color: red;">Authorization Denied</h1>
                <p>You declined the authorization. Please run the script again and click 'Authorize'.</p>
                </body></html>
            """)
        else:
            self.send_response(400)
            self.end_headers()
    
    def log_message(self, format, *args):
        pass  # Suppress logs

def get_token_with_activity_scope():
    print("="*60)
    print("STRAVA AUTHORIZATION WITH ACTIVITY PERMISSIONS")
    print("="*60)
    
    print("\n⚠️  YOUR CURRENT TOKEN DOESN'T HAVE ACTIVITY PERMISSIONS!")
    print("We need to re-authorize with the correct scope.\n")
    
    # Get Client ID and Secret
    print("Go to: https://www.strava.com/settings/api")
    print("Find your Client ID and Client Secret\n")
    
    client_id = input("Enter your Client ID (5-6 digits): ").strip()
    client_secret = input("Enter your Client Secret (40 characters): ").strip()
    
    # Validate
    if not client_id.isdigit() or len(client_id) < 5:
        print("❌ Invalid Client ID")
        return None
    
    if len(client_secret) != 40:
        print(f"❌ Client Secret should be 40 chars (got {len(client_secret)})")
        return None
    
    print("\n" + "="*60)
    print("STARTING AUTHORIZATION")
    print("="*60)
    
    # Start local server
    server = HTTPServer(('localhost', 8080), AuthHandler)
    server.auth_code = None
    server.scope = None
    
    server_thread = threading.Thread(target=server.serve_forever)
    server_thread.daemon = True
    server_thread.start()
    
    # CRITICAL: Request the RIGHT permissions!
    auth_url = (
        f"https://www.strava.com/oauth/authorize"
        f"?client_id={client_id}"
        f"&response_type=code"
        f"&redirect_uri=http://localhost:8080"
        f"&approval_prompt=force"  # Force re-approval even if previously authorized
        f"&scope=read,activity:read_all,profile:read_all"  # REQUEST ALL READ PERMISSIONS!
    )
    
    print("\n🔑 IMPORTANT: When Strava asks, make sure to:")
    print("   ✓ Check the box for 'View data about your activities'")
    print("   ✓ Click 'Authorize' (not 'Deny')")
    print("\n📌 Opening browser for authorization...")
    print("\nIf browser doesn't open, go to:")
    print(auth_url)
    
    webbrowser.open(auth_url)
    
    print("\n⏳ Waiting for authorization (60 second timeout)...")
    
    # Wait for callback
    timeout = 60
    start_time = time.time()
    while server.auth_code is None and (time.time() - start_time) < timeout:
        time.sleep(1)
    
    server.shutdown()
    
    if server.auth_code is None:
        print("❌ Authorization failed or timed out")
        print("\nMake sure to click 'Authorize' when Strava asks!")
        return None
    
    print("✅ Authorization code received!")
    
    # Check scope
    if server.scope:
        print(f"📋 Granted permissions: {server.scope}")
        if 'activity:read' not in server.scope and 'read_all' not in server.scope:
            print("⚠️  WARNING: Activity permissions might be missing!")
            print("Make sure you checked the activity box when authorizing!")
    
    # Exchange code for tokens
    print("\n🔄 Getting your access token...")
    
    response = requests.post(
        'https://www.strava.com/oauth/token',
        data={
            'client_id': client_id,
            'client_secret': client_secret,
            'code': server.auth_code,
            'grant_type': 'authorization_code'
        }
    )
    
    if response.status_code != 200:
        print(f"❌ Failed to get token: {response.status_code}")
        print(response.json())
        return None
    
    tokens = response.json()
    
    print("\n" + "="*60)
    print("🎉 SUCCESS! TOKENS WITH ACTIVITY PERMISSIONS:")
    print("="*60)

    print(f"\n📋 CLIENT ID:      {client_id}")
    print(f"📋 REFRESH TOKEN:  {tokens['refresh_token']}")
    print(f"\n(Access token also received — the heatmap will refresh it automatically)")
    
    # Save tokens
    with open('strava_tokens_with_permissions.json', 'w') as f:
        json.dump(tokens, f, indent=2)
    print("\n💾 Tokens saved to: strava_tokens_with_permissions.json")
    
    # Test the token
    print("\n🔍 Testing new token permissions...")
    
    # Test 1: Basic profile
    auth_header = {'Authorization': f"Bearer {tokens['access_token']}"}
    test1 = requests.get(
        "https://www.strava.com/api/v3/athlete", headers=auth_header
    )

    if test1.status_code == 200:
        athlete = test1.json()
        print(f"✅ Profile access works: {athlete.get('firstname')} {athlete.get('lastname')}")
    else:
        print(f"❌ Profile test failed: {test1.status_code}")

    # Test 2: Activities (the important one!)
    test2 = requests.get(
        "https://www.strava.com/api/v3/athlete/activities?per_page=1", headers=auth_header
    )
    
    if test2.status_code == 200:
        activities = test2.json()
        if activities:
            print(f"✅ ACTIVITY ACCESS WORKS! Found activity: {activities[0].get('name', 'Unnamed')}")
        else:
            print("✅ Activity access works (but no activities found yet)")
    else:
        print(f"❌ Activity access failed: {test2.status_code}")
        print(test2.json())
    
    return tokens

def main():
    tokens = get_token_with_activity_scope()
    
    if tokens:
        print("\n" + "="*60)
        print("✅ NEXT STEPS:")
        print("="*60)
        print("1. Open strava-viz.html in your browser")
        print("2. Enter your Client ID, Client Secret, and the Refresh Token above")
        print("3. Check 'Remember credentials' so you won't need to enter them again")
        print("4. Click 'Load Activities' — the heatmap will auto-refresh your token")
        print("\nYou only need to run this script once. The heatmap handles token")
        print("refresh automatically from now on.")
    else:
        print("\n❌ Failed to get proper authorization")
        print("Make sure to:")
        print("1. Click 'Authorize' (not 'Deny') when Strava asks")
        print("2. Check the box for activity permissions")
        print("3. Try running the script again")
    
    input("\nPress Enter to exit...")

if __name__ == "__main__":
    main()
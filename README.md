# Logfolio

_Logfolio_ is a personal trade journal web application that allows users to log, track, and analyze their trades. It features secure authentication, dynamic trade entry forms, real-time market data from external APIs, and insightful metrics to help users reflect on their performance.

---

## Features

-   User authentication (JWT based registration and login)
-   Trade journaling with editable fields
-   Performance tracking and historical trade logging
-   Real-time symbol search via Finnhub
-   Company profiles and stock recommendations
-   Related financial news via NewsAPI
-   Insider sentiment and IPO calendar data
-   Role-based access (admin and user)
-   Static and dynamic HTML pages

---

## Setup Instructions

### 1. Clone the Repository

git clone https://github.com/your-username/logfolio.git

cd logfolio

### 2. Install Dependecies

npm install

### 3. Configure Environment Variables

Create an .env file with the following format:
PORT=3000
MONGO_URI=your_mongo_connection_string
JWT_SECRET=your_jwt_secret
FINNHUB_API_KEY=your_finnhub_api_key
NEWS_API_KEY=your_newsapi_key

### 4. Start the Server

npm start

## API Routes and Usage

### Authentication:

POST /register
Registers a new user.

Request body: { name, email, password, role }

Response: { token }

POST /login
Authenticates an existing user.

Request body: { email, password }

Response: { token }

POST /logout
Logs out user (logs token server-side, no token invalidation).

### Trade Journal:

All routes below require a JWT token in the Authorization header.

POST /api/trades
Create a new trade entry.

GET /api/trades
Get all user trades. Admins see all.

GET /api/trades/:id
Get a specific trade by ID.

PATCH /api/trades/:id
Update a trade (cannot modify symbol or companyName).

DELETE /api/trades/:id
Delete a trade by ID.

### External Market Data:

GET /api/search-symbols?q=AAPL
Search stock symbols (via Finnhub)

GET /api/company-profile?symbol=AAPL
Get company profile data

GET /api/recommendations?symbol=AAPL
Get stock recommendations

GET /api/insider-sentiment?symbol=AAPL&from=2024-01-01&to=2024-03-01
Get insider trading sentiment data

GET /api/ipo-calendar?from=2024-06-01&to=2024-06-30
Get IPO events during a date range

GET /api/news?symbol=AAPL
Get news articles related to a symbol or company name

## User Roles

user: Can view, create, update, and delete their own trades

admin: Can view, update, and delete all trades

## Technologies Used:

Backend: Node.js, Express.js, MongoDB (Mongoose)

Authentication: JWT, Bcrypt

External APIs: Finnhub, NewsAPI

Frontend: Vanilla JS, HTML/CSS (served via public/)

## Deployment:

Deployed using Render and MongoDB Atlas.

**FULLY WORKING LINK:** https://logfolio.onrender.com/

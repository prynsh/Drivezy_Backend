# Backend Project

## Overview

This backend service provides endpoints to ingest files from Google Drive and search them using Pinecone DB. It employs Google OAuth 2.0 for secure, read-only access to Google Drive files and integrates them into a Pinecone database.

## Technologies Used

- **Express**: Web application framework for Node.js
- **TypeScript**: Typed superset of JavaScript
- **Google OAuth 2.0**: Authorization framework for accessing user data
- **Pinecone DB**: Vector database for storing and querying vector embeddings

## Endpoints

- **`POST /ingestion`**: Ingest files from Google Drive into the Pinecone database.
- **`GET /search`**: Search for files in the Pinecone database.

## Getting Started

### Prerequisites

Ensure you have **Node.js** and **npm** installed on your machine.

### Installation

1. **Clone the repository**:

   ```sh
   git clone https://github.com/prynsh/Drivezy_Backend.git
   cd Drivezy_Backend

2. Install Dependencies
   ```sh
   npm install
   ```

3. Configuration

   Copy the example environment variables file:
   ```sh
   cp .env.example .env
   ```

Add your credentials:
- **Google OAuth 2.0 Client ID and Secret**: Obtain these from the Google Developer Console. Refer to this guide for setup instructions: [Google OAuth using TypeScript, Express.js, Passport.js & MongoDB](#).
- **Pinecone API Key**: Obtain this from the Pinecone Console.

## Running the Backend
Start the development server:
```sh
npm run dev
```
The server will run on [http://localhost:5000](http://localhost:5000).


## Ingestion Process
The `/ingestion` endpoint retrieves files from the authenticated user's Google Drive and ingests them into the Pinecone database.

## Search Functionality
The `/search` endpoint allows searching for files within the Pinecone database based on vector embeddings.

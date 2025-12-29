# 🕷️ OnlineJobs.ph Scraper API (Dockerized)

[![Docker Pulls](https://img.shields.io/docker/pulls/henryjre/onlinejobs-scraper-api?style=for-the-badge&logo=docker&logoColor=white&color=0db7ed)](https://hub.docker.com/r/henryjre/onlinejobs-scraper-api)
[![GitHub Forks](https://img.shields.io/github/forks/henryjre/onlinejobs-scraper-api?style=for-the-badge&logo=github&logoColor=white&color=black)](https://github.com/henryjre/onlinejobs-scraper-api/network)
[![GitHub Stars](https://img.shields.io/github/stars/henryjre/onlinejobs-scraper-api?style=for-the-badge&logo=github&logoColor=white&color=black)](https://github.com/henryjre/onlinejobs-scraper-api/stargazers)

A robust, stealthy microservice designed to scrape job listings from OnlineJobs.ph. Built with **Node.js**, **Express**, and **Puppeteer**, this tool is containerized with **Docker** for easy deployment and integration.

## 🚀 Features

* **Dockerized:** Runs in an isolated container with all dependencies pre-installed.
* **Stealth Mode:** Uses `puppeteer-extra-plugin-stealth` to evade bot detection.
* **Smart Proxy Rotation:** Accepts custom proxies via API parameters (supports arrays or comma-separated lists).
* **Dual Modes:**
  * **Basic Fetch:** Fast scraping of job titles and links (~2s).
  * **Deep Fetch:** Visits individual job pages to extract full descriptions and salary info.
* **REST API:** Simple HTTP interface easy to trigger from Postman, Curl, or other API fetching tools.

## 🛠️ Tech Stack

* **Runtime:** Node.js
* **Browser Automation:** Puppeteer (Chrome)
* **Server:** Express.js
* **Containerization:** Docker & Docker Compose

---

## ⚙️ Installation & Setup

### Prerequisites

* Docker & Docker Compose installed on your machine.

**🐳 Official Docker Image:** You can pull the pre-built image directly from Docker Hub: [henryjre/onlinejobs-scraper-api](https://hub.docker.com/r/henryjre/onlinejobs-scraper-api)

### Option 1: Quick Start (Docker Hub)

The easiest way to run the scraper without downloading any code.

**Run via Docker CLI:**

```bash
docker run -d -p 1234:1234 --name onlinejobs-scraper henryjre/onlinejobs-scraper-api:latest
```

**Run via Docker Compose:**

Create a `docker-compose.yml` file with the following content:

```yaml
version: '3'
services:
  job-scraper:
    image: henryjre/onlinejobs-scraper-api:latest
    container_name: onlinejobs-scraper
    restart: unless-stopped
    ports:
      - "1234:1234"
```

Then start it:

```bash
docker-compose up -d
```

### Option 2: Build from Source (For Developers)

If you want to modify the code or build the image locally:

1. **Clone the Repository**

    ```bash
    git clone https://github.com/henryjre/onlinejobs-scraper-api.git
    cd onlinejobs-scraper-api
    ```

2. Build and Run via Docker

    ```bash
    docker-compose up -d --build
    ```

The API will start on port 1234 by default.

---

## 📡 API Documentation

`GET /search` - Searches job listings based on a keyword.

### Optional Query Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `keyword` | `string` | `""` | The search term (e.g., React Developer). If empty, returns latest jobs. |
| `limit` | `number` | `5` | Limits the number of results to prevent timeouts. |
| `deep_fetch` | `boolean` | `false` | Set to `true` to get full descriptions (Slower). |
| `proxies`/`proxy` | `string` | `null` | A single proxy, comma-separated list, or array of proxies. |

### Example Request (Basic)

```bash
curl "http://localhost:1234/search?keyword=virtual%20assistant&limit=3"
```

### Response

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "title": "Junior AI Automation Developer (Remote) Full Time",
      "jobType": "Full Time",
      "link": "https://www.onlinejobs.ph/jobseekers/job/Junior-AI-Automation-Developer-Remote-1541576"
    },
  ]
}
```

### Example Request (With Proxies & Deep Fetch)

```bash
curl "http://localhost:1234/search?keyword=react&deep_fetch=true&proxies=[http://user:pass@1.1.1.1:8080](http://user:pass@1.1.1.1:8080),[http://user:pass@2.2.2.2:8080](http://user:pass@2.2.2.2:8080)"
```

### Response

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "title": "Junior AI Automation Developer (Remote) Full Time",
      "jobType": "Full Time",
      "link": "https://www.onlinejobs.ph/jobseekers/job/Junior-AI-Automation-Developer-Remote-1541576",
      "description": "Are you obsessed with the future of AI Agents and Automation? We are looking for a hungry, tech-savvy AI Automation Engineer to join our team. This isn't...",
      "TYPE OF WORK": "Full Time",
      "WAGE / SALARY": "$600 - $800",
      "HOURS PER WEEK": "40",
      "DATE UPDATED": "Dec 28, 2025"
    }
  ]
}
```

---

## ⚠️ Disclaimer

This project is for **educational purposes only**. Web scraping may violate the Terms of Service of the target website. The author is not responsible for any misuse of this software or any bans resulting from its use. Please scrape responsibly and respect `robots.txt` policies.

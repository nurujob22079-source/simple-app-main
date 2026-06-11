# Simple App — Full-Stack Demo with Jenkins CI/CD

A tiny full-stack web app you can run locally and deploy through a Jenkins pipeline.

- **Backend:** Node.js + Express REST API (`backend/server.js`)
- **Frontend:** plain HTML/CSS/JS message board (`frontend/`)
- **Tests:** Node's built-in test runner (`backend/server.test.js`)
- **Packaging:** `Dockerfile`
- **CI/CD:** `Jenkinsfile`

---

## 1. Run it locally

```bash
npm install      # install dependencies
npm start        # start the server
# open http://localhost:3000
```

Other commands:

```bash
npm test         # run the tests
npm run dev      # auto-restart on file changes
```

---

## 2. How the app is structured

```
simple-app/
├── backend/
│   ├── server.js        # Express server + REST API
│   └── server.test.js   # tests
├── frontend/            # static files served by Express
│   ├── index.html
│   ├── style.css
│   └── app.js           # calls the backend via fetch()
├── Dockerfile           # builds a production container
├── Jenkinsfile          # the CI/CD pipeline
└── package.json
```

The backend serves the frontend **and** exposes the API, so it's a single deployable unit. Key endpoint for automation: `GET /api/health` returns `{"status":"ok"}` — pipelines and load balancers use it to confirm the app is alive.

---

## 3. Deploying with Jenkins — full walkthrough

### What is a Jenkins pipeline?

Jenkins is an automation server. A **pipeline** is a series of steps Jenkins runs for you every time your code changes: install → test → build → deploy. Instead of doing these by hand, you describe them once in a `Jenkinsfile` (committed to your repo), and Jenkins executes them.

Our `Jenkinsfile` has these stages:

| Stage | What it does | Why it matters |
|-------|--------------|----------------|
| **Checkout** | Pulls your code from Git | Pipeline always runs on the latest commit |
| **Install** | `npm ci` | Reproducible dependency install |
| **Test** | `npm test` | **Stops the pipeline if tests fail** — bad code never deploys |
| **Build Docker image** | `docker build` | Packages app into a portable container |
| **Deploy** | `docker run` | Starts the new version |
| **Smoke test** | `curl /api/health` | Confirms the deploy is actually serving traffic |

A failure in any stage stops the pipeline and marks the build red.

---

### Step-by-step setup

#### Prerequisites
- A running **Jenkins** server. Quickest way to try it locally:
  ```bash
  docker run -d -p 8080:8080 -p 50000:50000 \
    -v jenkins_home:/var/jenkins_home \
    --name jenkins jenkins/jenkins:lts
  ```
  Then open `http://localhost:8080` and follow the unlock + setup wizard (install "suggested plugins").
- **Docker** and **Node** available on the Jenkins agent (the machine that runs the build). For the local Jenkins container above to run `docker` commands, it needs access to the Docker socket — for a real setup use a dedicated agent with Docker installed.
- Your code pushed to a **Git repository** (GitHub, GitLab, etc.).

#### 1. Push this project to Git
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin <your-repo-url>
git push -u origin main
```

#### 2. Create the pipeline job in Jenkins
1. On the Jenkins dashboard, click **New Item**.
2. Enter a name (e.g. `simple-app`), choose **Pipeline**, click **OK**.
3. Scroll to the **Pipeline** section.
4. Set **Definition** = `Pipeline script from SCM`.
5. **SCM** = `Git`, then paste your repository URL (add credentials if it's private).
6. **Branch** = `*/main`.
7. **Script Path** = `Jenkinsfile` (the default — this is the file in this repo).
8. Click **Save**.

#### 3. Run it
- Click **Build Now**.
- Watch the **Stage View** / **Console Output**. You'll see each stage run in order.
- When it finishes green, the app is running. With our `Deploy` stage it's at `http://<agent-host>:3000`.

#### 4. Make it automatic (optional but the whole point of CI/CD)
So Jenkins builds on every push instead of you clicking "Build Now":
- **Webhook (best):** In your Git host, add a webhook to `http://<your-jenkins>/github-webhook/` (GitHub) and enable **GitHub hook trigger** in the job config.
- **Polling (simplest):** In the job config under **Build Triggers**, enable **Poll SCM** with schedule `H/5 * * * *` (checks every ~5 min).

---

### Deploying to remote AWS EC2 (staging + production)

The current `Jenkinsfile` does **not** deploy to localhost. It builds the image, pushes it to a registry, then **SSHes into remote EC2 servers** to pull and run it — first to **staging**, then (after you click approve) to **production**.

```
build → push to registry → deploy STAGING → smoke test
      → [manual approval] → deploy PRODUCTION → smoke test
```

#### Step A — Create the EC2 instances (do this in AWS; one for staging, one for prod)

1. AWS Console → **EC2 → Launch instance**.
2. **AMI:** Amazon Linux 2023 (or Ubuntu). **Type:** `t3.micro` is fine for a demo.
3. **Key pair:** create/download a `.pem` key — you'll give this to Jenkins so it can SSH in.
4. **Security group:** allow inbound **SSH (22)** from your Jenkins server's IP, and **HTTP (80)** from anywhere (`0.0.0.0/0`).
5. Launch, then note the **Public IPv4 DNS** — that's your `STAGING_HOST` / `PROD_HOST`.
6. SSH in once and install Docker:
   ```bash
   ssh -i your-key.pem ec2-user@<public-dns>
   sudo yum install -y docker        # Ubuntu: sudo apt install -y docker.io
   sudo systemctl enable --now docker
   sudo usermod -aG docker ec2-user  # so docker runs without sudo; re-login after
   ```

   > CLI alternative (instead of the console wizard):
   > ```bash
   > aws ec2 run-instances --image-id ami-xxxx --count 1 \
   >   --instance-type t3.micro --key-name your-key \
   >   --security-group-ids sg-xxxx
   > ```

#### Step B — Add credentials in Jenkins (Manage Jenkins → Credentials)

The pipeline references three credential IDs — create them or rename in the `Jenkinsfile`:

| ID | Type | What it is |
|----|------|-----------|
| `dockerhub-creds` | Username with password | Your Docker Hub (registry) login, to push/pull the image |
| `staging-ssh-key` | SSH Username with private key | The `.pem` key + `ec2-user` for the **staging** box |
| `prod-ssh-key` | SSH Username with private key | The `.pem` key + `ec2-user` for the **production** box |

#### Step C — Edit the placeholders at the top of the `Jenkinsfile`

```groovy
REGISTRY_REPO = "youruser/simple-app"   // your Docker Hub repo
STAGING_HOST  = "staging.example.com"   // staging EC2 public DNS
PROD_HOST     = "prod.example.com"      // production EC2 public DNS
SSH_USER      = "ec2-user"              // "ubuntu" on Ubuntu AMIs
```

#### Step D — Run it

Click **Build Now**. The pipeline deploys to staging, runs a smoke test, then **pauses** at the *Approve production deploy* step. Click **Deploy to production** to finish. Visit `http://<prod-dns>/` to see it live.

> **Other targets:** the structure (test → build → push → deploy → smoke test) is identical for other platforms — only the deploy command changes: `kubectl set image ...` for Kubernetes, or `aws ecs update-service ...` for AWS ECS.

---

## 4. Common gotchas

- **`docker: not found` in Jenkins** — the agent doesn't have Docker. Install it, or use a Jenkins agent image that includes Docker.
- **Tests pass locally but fail in Jenkins** — usually a missing dependency; `npm ci` needs `package-lock.json` committed (it is).
- **Port 3000 already in use on the agent** — the `Deploy` stage does `docker rm -f` first to clear the old container; if something else holds the port, change the host port mapping.
- **Permission denied on Docker socket** — the Jenkins user needs to be in the `docker` group (or socket mounted into the Jenkins container).

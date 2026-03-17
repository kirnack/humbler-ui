# ---- Stage 1: Build humble-cli ----
FROM golang:1.24-alpine AS humble-builder

RUN go install github.com/smbl64/humble-cli/cmd/humble-cli@latest

# ---- Stage 2: Runtime ----
FROM python:3.12-slim

# Copy the humble-cli binary from the builder stage
COPY --from=humble-builder /go/bin/humble-cli /usr/local/bin/humble-cli

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ .

# Create default directories for config and downloads
RUN mkdir -p /config /downloads

# humble-cli stores its session key at $HOME/.humble-cli-key
ENV HOME=/config
ENV DOWNLOAD_DIR=/downloads

EXPOSE 5000

CMD ["python", "app.py"]

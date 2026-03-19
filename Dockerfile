# ---- Stage 1: Build humble-cli ----
FROM golang:1.24-alpine AS humble-builder

RUN go install github.com/smbl64/humble-cli/cmd/humble-cli@latest

# ---- Stage 2: Runtime ----
FROM ruby:3.3-slim

# Install build dependencies for native gems (e.g. puma/nio4r)
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
      build-essential \
      libssl-dev && \
    rm -rf /var/lib/apt/lists/*

# Copy the humble-cli binary from the builder stage
COPY --from=humble-builder /go/bin/humble-cli /usr/local/bin/humble-cli

WORKDIR /app

# Install Ruby gems
COPY Gemfile Gemfile.lock ./
RUN bundle install --without development test

# Copy application source
COPY . .

# Create default directories for config and downloads
RUN mkdir -p /config /downloads

# humble-cli stores its session key at $HOME/.humble-cli-key
ENV HOME=/config
ENV DOWNLOAD_DIR=/downloads
ENV RAILS_ENV=production
ENV RAILS_LOG_TO_STDOUT=true
ENV RAILS_SERVE_STATIC_FILES=true

EXPOSE 3000

CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]

class HomeController < ApplicationController
  def index
    # Seed session key from env var on first boot (idempotent)
    env_key = ENV["HUMBLE_SESSION_KEY"].to_s.strip
    humble_cli.save_session_key(env_key) if env_key.present? && !humble_cli.authenticated?
  end
end

# Allow SECRET_KEY_BASE to be provided via environment variable.
# This avoids needing the encrypted credentials file in the container.
# Raise an error in production if SECRET_KEY_BASE is not set, since
# auto-generating one would invalidate sessions on every restart.
if Rails.env.production? && ENV["SECRET_KEY_BASE"].blank?
  raise "SECRET_KEY_BASE environment variable must be set in production"
end

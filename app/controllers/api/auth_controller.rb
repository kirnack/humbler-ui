module Api
  class AuthController < ApplicationController
    def create
      session_key = params[:session_key].to_s.strip

      if session_key.empty?
        render json: { error: "session_key is required" }, status: :bad_request
        return
      end

      humble_cli.save_session_key(session_key)
      render json: { status: "ok" }
    rescue ArgumentError => e
      render json: { error: e.message }, status: :bad_request
    end
  end
end

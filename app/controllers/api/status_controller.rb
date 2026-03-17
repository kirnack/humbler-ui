module Api
  class StatusController < ApplicationController
    def show
      render json: { authenticated: humble_cli.authenticated? }
    end
  end
end

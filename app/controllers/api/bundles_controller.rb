module Api
  class BundlesController < ApplicationController
    before_action :require_authenticated!

    def index
      bundles = humble_cli.list_bundles
      render json: { bundles: bundles }
    rescue HumbleCli::Error, Errno::ENOENT => e
      render json: { error: e.message }, status: :internal_server_error
    end
  end
end

require "open3"
require "csv"

class ApplicationController < ActionController::Base
  # Shared application-wide task store (survives across requests within a process)
  TASK_STORE = DownloadTaskStore.new

  private

  def humble_cli
    @humble_cli ||= HumbleCli.new
  end

  def require_authenticated!
    render json: { error: "not_authenticated" }, status: :unauthorized unless humble_cli.authenticated?
  end
end

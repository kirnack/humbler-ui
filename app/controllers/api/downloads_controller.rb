module Api
  class DownloadsController < ApplicationController
    before_action :require_authenticated!

    def create
      bundle_key = params[:key].to_s.strip
      if bundle_key.empty?
        render json: { error: "key is required" }, status: :bad_request
        return
      end

      formats = Array(params[:formats]).map(&:to_s).map(&:strip).reject(&:empty?)
      task_id = SecureRandom.uuid

      TASK_STORE.create(task_id)
      DownloadJob.perform_later(task_id, bundle_key, formats)

      render json: { task_id: task_id }
    end

    def show
      task = TASK_STORE.fetch(params[:task_id])
      return head :not_found if task.nil?

      render json: task
    end
  end
end

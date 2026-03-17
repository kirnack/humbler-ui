class DownloadJob < ApplicationJob
  queue_as :default

  def perform(task_id, bundle_key, formats)
    cli = HumbleCli.new

    exit_status = cli.download_bundle(bundle_key, formats: formats) do |line|
      ApplicationController::TASK_STORE.append_line(task_id, line)
    end

    ApplicationController::TASK_STORE.finish(task_id, success: exit_status.success?)
  rescue StandardError => e
    ApplicationController::TASK_STORE.fail(task_id, e.message)
  end
end

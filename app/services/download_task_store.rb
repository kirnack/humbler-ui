# In-process task store for tracking download progress.
# Keys are UUIDs (strings); values are hashes with :status, :lines, :error.
class DownloadTaskStore
  STATUSES = %w[running completed failed].freeze

  def initialize
    @tasks = {}
    @mutex = Mutex.new
  end

  def create(task_id)
    @mutex.synchronize do
      @tasks[task_id] = { status: "running", lines: [], error: nil }
    end
  end

  def append_line(task_id, line)
    @mutex.synchronize do
      @tasks.dig(task_id, :lines)&.push(line)
    end
  end

  def finish(task_id, success:)
    @mutex.synchronize do
      @tasks[task_id][:status] = success ? "completed" : "failed"
    end
  end

  def fail(task_id, error_message)
    @mutex.synchronize do
      task = @tasks[task_id]
      return unless task

      task[:status] = "failed"
      task[:error]  = error_message
    end
  end

  def fetch(task_id)
    @mutex.synchronize { @tasks[task_id]&.dup }
  end
end

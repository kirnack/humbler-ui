# Thin wrapper around the humble-cli binary.
# All interactions with humble-cli go through this class.
class HumbleCli
  INVALID_CHARS = %r{[/\\?%*:|"<>;\n=]}.freeze

  class Error < StandardError; end

  def initialize
    @bin        = ENV.fetch("HUMBLE_CLI", "humble-cli")
    @home_dir   = ENV.fetch("HOME", "/config")
    @download_dir = ENV.fetch("DOWNLOAD_DIR", "/downloads")
  end

  def authenticated?
    key_file = Pathname.new(@home_dir).join(".humble-cli-key")
    key_file.exist? && key_file.read.strip.present?
  end

  def save_session_key(key)
    key = key.strip
    raise ArgumentError, "session_key cannot be empty" if key.empty?

    key_file = Pathname.new(@home_dir).join(".humble-cli-key")
    key_file.parent.mkpath
    key_file.write(key)
    key_file.chmod(0o600)
  end

  # Returns an array of bundle hashes:
  # { key:, name:, size:, claimed:, downloaded: }
  def list_bundles
    stdout, stderr, status = run(
      ["list", "--field", "key", "--field", "name", "--field", "size", "--field", "claimed"],
      timeout: 60
    )
    raise Error, "humble-cli error: #{stderr.strip.presence || "unknown error"}" unless status.success?

    CSV.parse(stdout).filter_map do |row|
      next if row.length < 4

      key, name, size, claimed = row.map(&:strip)
      next if key.blank?

      {
        key: key,
        name: name,
        size: size,
        claimed: claimed,
        downloaded: downloaded?(name)
      }
    end
  end

  # Spawn humble-cli download as a subprocess and stream lines to a block.
  def download_bundle(bundle_key, formats: [])
    cmd = [@bin, "download", bundle_key]
    formats.each { |f| cmd += ["-f", f] }

    Pathname.new(@download_dir).mkpath

    env = { "HOME" => @home_dir }
    Open3.popen2e(env, *cmd, chdir: @download_dir, unsetenv_others: true) do |_stdin, stdout_err, wait_thr|
      stdout_err.each_line do |line|
        yield line.chomp if block_given?
      end
      wait_thr.value
    end
  end

  def download_dir
    @download_dir
  end

  private

  def run(args, timeout: 30)
    env = { "HOME" => @home_dir }
    stdout, stderr, status = Open3.capture3(env, @bin, *args, unsetenv_others: true)
    [stdout, stderr, status]
  end

  # Mirror ReplaceInvalidCharsInFilename from humble-cli
  def sanitize(name)
    name.gsub(INVALID_CHARS, " ").strip
  end

  def downloaded?(bundle_name)
    dir = Pathname.new(@download_dir).join(sanitize(bundle_name))
    return false unless dir.directory?

    dir.glob("**/*").any?(&:file?)
  end
end

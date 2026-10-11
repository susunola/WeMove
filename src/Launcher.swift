import Cocoa

class AppDelegate: NSObject, NSApplicationDelegate {
  var process: Process?
  var languageTimer: Timer?
  var statusItem: NSStatusItem?
  var quitItem: NSMenuItem?
  var showItem: NSMenuItem?

  var english: Bool {
    let folder = ProcessInfo.processInfo.environment["PANMOVER_DATA_DIR"].map { URL(fileURLWithPath: $0) } ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/PanMover")
    guard let bytes = try? Data(contentsOf: folder.appendingPathComponent("ui-preferences.json")),
          let value = (try? JSONSerialization.jsonObject(with: bytes)) as? [String: Any] else { return false }
    return value["language"] as? String == "en"
  }

  func updateLanguage() {
    quitItem?.title = english ? "Quit" : "退出"
    showItem?.title = english ? "Show Window" : "显示窗口"
  }

  func applicationDidFinishLaunching(_ notification: Notification) {
    // Menu bar resident mode
    statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    statusItem?.button?.title = "📦"
    statusItem?.button?.toolTip = english ? "WeMove / Cloud Transfer" : "网盘搬运助手"

    let menu = NSMenu()
    showItem = NSMenuItem(title: "显示窗口", action: #selector(showWindow), keyEquivalent: "s")
    menu.addItem(showItem!)
    menu.addItem(NSMenuItem.separator())
    quitItem = NSMenuItem(title: "退出", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
    menu.addItem(quitItem!)
    statusItem?.menu = menu
    updateLanguage()

    languageTimer = Timer.scheduledTimer(withTimeInterval: 2, repeats: true) { [weak self] _ in
      self?.updateLanguage()
    }

    // Keep process running in background
    let p = Process()
    p.executableURL = Bundle.main.executableURL!.deletingLastPathComponent().appendingPathComponent("node")
    p.arguments = [Bundle.main.resourceURL!.appendingPathComponent("server.cjs").path]
    p.terminationHandler = { p in
      if p.terminationStatus != 0 {
        DispatchQueue.main.async {
          let alert = NSAlert()
          alert.messageText = self.english ? "Cloud Transfer failed to start" : "搬运助手启动失败"
          alert.informativeText = self.english ? "Check that the app was fully extracted." : "请检查应用是否完整解压。"
          alert.runModal()
          NSApp.terminate(nil)
        }
      }
    }
    do {
      try p.run()
      process = p
    } catch {
      let a = NSAlert()
      a.messageText = error.localizedDescription
      a.runModal()
      NSApp.terminate(nil)
    }

    // Prefer accessory / menu bar style when possible
    NSApp.setActivationPolicy(.accessory)
  }

  @objc func showWindow() {
    // In full app this would activate the web UI window; placeholder for now
    NSApp.activate(ignoringOtherApps: true)
  }

  func applicationWillTerminate(_ notification: Notification) {
    languageTimer?.invalidate()
    // Best-effort: signal node process to pause cleanly before terminate
    process?.interrupt()
    Thread.sleep(forTimeInterval: 0.5)
    process?.terminate()
  }

  func notifyCompletion(title: String = "传输完成", body: String = "有任务已完成") {
    // Simple system notification via NSUserNotification (legacy but works) or log
    let notification = NSUserNotification()
    notification.title = title
    notification.informativeText = body
    notification.soundName = NSUserNotificationDefaultSoundName
    NSUserNotificationCenter.default.deliver(notification)
  }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)
app.run()

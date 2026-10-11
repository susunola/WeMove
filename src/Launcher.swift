import Cocoa
class AppDelegate: NSObject, NSApplicationDelegate {
 var process: Process?
 var languageTimer: Timer?
 var quitItem: NSMenuItem?
 var english: Bool {
  let folder=ProcessInfo.processInfo.environment["PANMOVER_DATA_DIR"].map { URL(fileURLWithPath:$0) } ?? FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent("Library/Application Support/PanMover")
  guard let bytes=try? Data(contentsOf:folder.appendingPathComponent("ui-preferences.json")),let value=(try? JSONSerialization.jsonObject(with:bytes)) as? [String:Any] else {return false}
  return value["language"] as? String == "en"
 }
 func updateLanguage(){quitItem?.title=english ? "Quit Cloud Transfer" : "退出搬运助手"}

 func applicationDidFinishLaunching(_ notification: Notification) {
  let menu=NSMenu(); let item=NSMenuItem();menu.addItem(item);let sub=NSMenu();let quit=NSMenuItem(title:"退出搬运助手",action:#selector(NSApplication.terminate(_:)),keyEquivalent:"q");sub.addItem(quit);quitItem=quit;updateLanguage();languageTimer=Timer.scheduledTimer(withTimeInterval:2,repeats:true){[weak self] _ in self?.updateLanguage()};item.submenu=sub;NSApplication.shared.mainMenu=menu
  let p=Process();p.executableURL=Bundle.main.executableURL!.deletingLastPathComponent().appendingPathComponent("node");p.arguments=[Bundle.main.resourceURL!.appendingPathComponent("server.cjs").path];p.terminationHandler={ p in if p.terminationStatus != 0 {DispatchQueue.main.async {let alert=NSAlert();alert.messageText=self.english ? "Cloud Transfer failed to start" : "搬运助手启动失败";alert.informativeText=self.english ? "Check that the app was fully extracted." : "请检查应用是否完整解压。";alert.runModal();NSApp.terminate(nil)}}};do {try p.run();process=p} catch {let a=NSAlert();a.messageText=error.localizedDescription;a.runModal();NSApp.terminate(nil)}
 }
 func applicationWillTerminate(_ notification: Notification){languageTimer?.invalidate();process?.terminate()}
}
let app=NSApplication.shared;let delegate=AppDelegate();app.delegate=delegate;app.setActivationPolicy(.regular);app.run()

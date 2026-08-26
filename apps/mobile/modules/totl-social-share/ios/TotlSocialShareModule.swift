import ExpoModulesCore
import UIKit

/**
 * Opens WhatsApp / Instagram share extensions directly (Reel/Post/Story/Message
 * for Instagram, chat picker for WhatsApp) without the iOS system share sheet.
 */
public class TotlSocialShareModule: Module {
  static var documentController: UIDocumentInteractionController?

  public func definition() -> ModuleDefinition {
    Name("TotlSocialShare")

    AsyncFunction("openInApp") { (fileUri: String, uti: String, fileExtension: String, promise: Promise) in
      let source = Self.fileURL(from: fileUri)
      guard FileManager.default.isReadableFile(atPath: source.path) else {
        promise.reject("TotlShare", "Share image is missing")
        return
      }

      guard let host = Self.presentationViewController() else {
        promise.reject("TotlShare", "Could not present the share menu")
        return
      }

      if let identifiers = Self.extensionIdentifiers(for: uti) {
        TotlExtensionShare.present(source, withIdentifiers: identifiers, from: host) { error in
          if let error {
            promise.reject("TotlShare", error.localizedDescription)
          } else {
            promise.resolve(true)
          }
        }
        return
      }

      let dest = FileManager.default.temporaryDirectory.appendingPathComponent("totl-share.\(fileExtension)")
      try? FileManager.default.removeItem(at: dest)
      do {
        try FileManager.default.copyItem(at: source, to: dest)
      } catch {
        promise.reject("TotlShare", "Could not prepare the share image")
        return
      }

      let controller = UIDocumentInteractionController(url: dest)
      controller.uti = uti
      controller.name = dest.lastPathComponent
      Self.documentController = controller

      let presented = controller.presentOpenInMenu(from: host.view.bounds, in: host.view, animated: true)
      if !presented {
        Self.documentController = nil
        promise.reject("TotlShare", "That app is not installed")
        return
      }
      promise.resolve(true)
    }
    .runOnQueue(.main)
  }

  private static func extensionIdentifiers(for uti: String) -> [String]? {
    let key = uti.lowercased()
    if key.contains("whatsapp") {
      return [
        "net.whatsapp.WhatsApp.ShareExtension",
        "net.whatsapp.WhatsAppSMB.ShareExtension",
      ]
    }
    if key.contains("instagram") {
      return [
        "com.burbn.instagram.shareextension",
      ]
    }
    return nil
  }

  private static func fileURL(from uri: String) -> URL {
    if uri.hasPrefix("file://"), let url = URL(string: uri) {
      return url
    }
    return URL(fileURLWithPath: uri)
  }

  private static func presentationViewController() -> UIViewController? {
    var window: UIWindow?
    for scene in UIApplication.shared.connectedScenes {
      guard let windowScene = scene as? UIWindowScene,
            windowScene.activationState == .foregroundActive else { continue }
      window = windowScene.windows.first(where: \.isKeyWindow) ?? windowScene.windows.first
      if window != nil { break }
    }
    if window == nil {
      window = UIApplication.shared.windows.first(where: \.isKeyWindow) ?? UIApplication.shared.windows.first
    }
    guard var controller = window?.rootViewController else { return nil }
    while let presented = controller.presentedViewController {
      controller = presented
    }
    return controller
  }
}

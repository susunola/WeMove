import Foundation
import Security
let account=CommandLine.arguments.dropFirst().first ?? ""
guard account.range(of:"^[a-f0-9]{64}$",options:.regularExpression) != nil else {exit(2)}
let query:[String:Any]=[kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:"WeMove.CredentialKey",kSecAttrAccount as String:account,kSecReturnData as String:true,kSecMatchLimit as String:kSecMatchLimitOne]
var result:CFTypeRef?
let status=SecItemCopyMatching(query as CFDictionary,&result)
if status == errSecSuccess, let data=result as? Data {print(data.base64EncodedString());exit(0)}
guard status == errSecItemNotFound else {fputs("Keychain unavailable: \(status)\n",stderr);exit(1)}
var bytes=[UInt8](repeating:0,count:32)
guard SecRandomCopyBytes(kSecRandomDefault,bytes.count,&bytes) == errSecSuccess else {exit(1)}
let data=Data(bytes)
var item=query;item.removeValue(forKey:kSecReturnData as String);item.removeValue(forKey:kSecMatchLimit as String);item[kSecValueData as String]=data;item[kSecAttrAccessible as String]=kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
let added=SecItemAdd(item as CFDictionary,nil)
guard added == errSecSuccess else {fputs("Keychain unavailable: \(added)\n",stderr);exit(1)}
print(data.base64EncodedString())

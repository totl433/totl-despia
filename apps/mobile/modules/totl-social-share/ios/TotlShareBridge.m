#import "TotlShareBridge.h"
#import "LNExtensionExecutor.h"

@implementation TotlExtensionShare

+ (void)presentURL:(NSURL *)fileURL
    withIdentifiers:(NSArray<NSString *> *)identifiers
               from:(UIViewController *)host
         completion:(void (^)(NSError * _Nullable error))completion {
  NSError *lastError = nil;
  for (NSString *identifier in identifiers) {
    NSError *error = nil;
    LNExtensionExecutor *executor = [[LNExtensionExecutor alloc] initWithExtensionIdentifier:identifier error:&error];
    if (executor == nil) {
      lastError = error;
      continue;
    }

    [executor executeWithActivityItems:@[fileURL]
                      onViewController:host
                     completionHandler:^(BOOL completed, NSArray *returnedItems, NSError *activityError) {
      if (completion) {
        completion(activityError);
      }
    }];
    return;
  }

  if (completion) {
    completion(lastError ?: [NSError errorWithDomain:@"TotlShare" code:1 userInfo:@{
      NSLocalizedDescriptionKey: @"That app is not installed",
    }]);
  }
}

@end

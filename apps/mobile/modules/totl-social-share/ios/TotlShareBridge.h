#import <UIKit/UIKit.h>

NS_ASSUME_NONNULL_BEGIN

@interface TotlExtensionShare : NSObject
+ (void)presentURL:(NSURL *)fileURL
    withIdentifiers:(NSArray<NSString *> *)identifiers
               from:(UIViewController *)host
         completion:(void (^)(NSError * _Nullable error))completion;
@end

NS_ASSUME_NONNULL_END

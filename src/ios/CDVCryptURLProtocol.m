//
//  CDVCryptURLProtocol.m
//  CordovaLib
//
//  Created by tkyaji on 2015/07/15.
//
//  Modified by finscn on 2016/12/20.
//
//

#import "CDVCryptURLProtocol.h"

#import <MobileCoreServices/MobileCoreServices.h>


static const NSString* SECRET_HEADER = @"=SE=";
static const NSString* SECRET_KEY = @"";

@implementation CDVCryptURLProtocol

+ (BOOL)canInitWithRequest:(NSURLRequest*)theRequest
{
    return YES;
}

- (void)startLoading
{
    NSURL* url = self.request.URL;
    
    NSString *mimeType = [self getMimeType:url];
    
    NSMutableData *data = [NSMutableData dataWithContentsOfFile:url.path];
    
    [self decodeData:data];
    
    [self sendResponseWithResponseCode:200 data:data mimeType:mimeType];
    
    [super startLoading];
}


-(void)decodeData:(NSMutableData *)data {
    
    if (!data){
        return;
    }
    
    NSData *headData = [SECRET_HEADER dataUsingEncoding:NSUTF8StringEncoding];
    size_t headLen = headData.length;
    char const *head = headData.bytes;
    
    char const *bytes = data.bytes;
    for (int i = 0; i < headLen; i++) {
        if (bytes[i]!=head[i]){
            return;
        };
    }
    
    NSData *keyData = [SECRET_KEY dataUsingEncoding:NSUTF8StringEncoding];
    size_t keyLen = keyData.length;
    char const *key = keyData.bytes;
    
    NSRange range = NSMakeRange(0, headLen);
    [data replaceBytesInRange:range withBytes:NULL length:0];
    size_t dataSize = data.length;
    char *mutableBytes = data.mutableBytes;
    
    for (int i = 0; i < dataSize; i++) {
        char v = bytes[i];
        char kv = key[i % keyLen];
        mutableBytes[i] = v ^ kv;
    }
}


- (NSString*)getMimeType:(NSURL *)url
{
    NSString *fullPath = url.path;
    NSString *mimeType = nil;
    
    if (fullPath) {
        CFStringRef typeId = UTTypeCreatePreferredIdentifierForTag(kUTTagClassFilenameExtension, (__bridge CFStringRef)[fullPath pathExtension], NULL);
        if (typeId) {
            mimeType = (__bridge_transfer NSString*)UTTypeCopyPreferredTagWithClass(typeId, kUTTagClassMIMEType);
            if (!mimeType) {
                // special case for m4a
                if ([(__bridge NSString*)typeId rangeOfString : @"m4a-audio"].location != NSNotFound) {
                    mimeType = @"audio/mp4";
                } else if ([[fullPath pathExtension] rangeOfString:@"wav"].location != NSNotFound) {
                    mimeType = @"audio/wav";
                } else if ([[fullPath pathExtension] rangeOfString:@"css"].location != NSNotFound) {
                    mimeType = @"text/css";
                }
            }
            CFRelease(typeId);
        }
    }
    return mimeType;
}


- (NSString*)getMimeTypeFromPath:(NSString*)fullPath
{
    NSString* mimeType = nil;
    
    if (fullPath) {
        CFStringRef typeId = UTTypeCreatePreferredIdentifierForTag(kUTTagClassFilenameExtension, (__bridge CFStringRef)[fullPath pathExtension], NULL);
        if (typeId) {
            mimeType = (__bridge_transfer NSString*)UTTypeCopyPreferredTagWithClass(typeId, kUTTagClassMIMEType);
            if (!mimeType) {
                // special case for m4a
                if ([(__bridge NSString*)typeId rangeOfString : @"m4a-audio"].location != NSNotFound) {
                    mimeType = @"audio/mp4";
                } else if ([[fullPath pathExtension] rangeOfString:@"wav"].location != NSNotFound) {
                    mimeType = @"audio/wav";
                } else if ([[fullPath pathExtension] rangeOfString:@"css"].location != NSNotFound) {
                    mimeType = @"text/css";
                }
            }
            CFRelease(typeId);
        }
    }
    return mimeType;
}

- (void)sendResponseWithResponseCode:(NSInteger)statusCode data:(NSData*)data mimeType:(NSString*)mimeType
{
    if (mimeType == nil) {
        mimeType = @"text/plain";
    }
    
    NSHTTPURLResponse* response = [[NSHTTPURLResponse alloc] initWithURL:[[self request] URL] statusCode:statusCode HTTPVersion:@"HTTP/1.1" headerFields:@{@"Content-Type" : mimeType}];
    
    [[self client] URLProtocol:self didReceiveResponse:response cacheStoragePolicy:NSURLCacheStorageNotAllowed];
    if (data != nil) {
        [[self client] URLProtocol:self didLoadData:data];
    }
    [[self client] URLProtocolDidFinishLoading:self];
}

@end

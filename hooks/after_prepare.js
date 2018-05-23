var fs = require('fs');
var path = require('path');

var URL_FLAG = '/+++/';
var SECRET_KEY_FILE = 'secret.js';
var JAVA_FILE = 'com/tkyaji/cordova/DecryptResource.java';
var IOS_FILE = 'CDVCryptURLProtocol.m';

module.exports = function(context) {

    var path = context.requireCordovaModule('path'),
        fs = context.requireCordovaModule('fs'),
        crypto = context.requireCordovaModule('crypto'),
        Q = context.requireCordovaModule('q'),
        cordova_util = context.requireCordovaModule('cordova-lib/src/cordova/util'),
        platforms = context.requireCordovaModule('cordova-lib/src/platforms/platforms'),
        Parser = context.requireCordovaModule('cordova-lib/src/cordova/metadata/parser'),
        ParserHelper = context.requireCordovaModule('cordova-lib/src/cordova/metadata/parserhelper/ParserHelper'),
        ConfigParser = context.requireCordovaModule('cordova-common').ConfigParser;

    var deferral = new Q.defer();
    var projectRoot = cordova_util.cdProjectRoot();

    var targetFiles = loadCryptFileTargets();

    context.opts.platforms.filter(function(platform) {
        var pluginInfo = context.opts.plugin.pluginInfo;
        return pluginInfo.getPlatformsArray().indexOf(platform) > -1;

    }).forEach(function(platform) {
        var platformPath = path.join(projectRoot, 'platforms', platform);
        var platformApi = platforms.getPlatformApi(platform, platformPath);
        var platformInfo = platformApi.getPlatformInfo();
        var wwwDir = platformInfo.locations.www;

        var secretKey = fs.readFileSync(wwwDir + '/' + SECRET_KEY_FILE, 'utf-8');
        var replaceText = String(new Date());
        fs.writeFileSync(wwwDir + '/' + SECRET_KEY_FILE, replaceText, 'utf-8');

        if (platform == 'ios') {
            var pluginDir;
            try {
                var ios_parser = context.requireCordovaModule('cordova-lib/src/cordova/metadata/ios_parser'),
                    iosParser = new ios_parser(platformPath);
                pluginDir = path.join(iosParser.cordovaproj, 'Plugins', context.opts.plugin.id);
            } catch (err) {
                var xcodeproj_dir = fs.readdirSync(platformPath).filter(function(e) { return e.match(/\.xcodeproj$/i); })[0],
                    xcodeproj = path.join(platformPath, xcodeproj_dir),
                    originalName = xcodeproj.substring(xcodeproj.lastIndexOf(path.sep) + 1, xcodeproj.indexOf('.xcodeproj')),
                    cordovaproj = path.join(platformPath, originalName);

                pluginDir = path.join(cordovaproj, 'Plugins', context.opts.plugin.id);
            }
            replaceCryptKey_ios(pluginDir, secretKey);

        } else if (platform == 'android') {
            var pluginInfo = context.opts.plugin.pluginInfo;
            var pluginDir = path.join(pluginInfo.dir, 'src', platform);
            replaceCryptKey_android(pluginDir, secretKey);

            var cfg = new ConfigParser(platformInfo.projectConfig.path);
            cfg.doc.getroot().getchildren().filter(function(child, idx, arr) {
                return (child.tag == 'content');
            }).forEach(function(child) {
                child.attrib.src = URL_FLAG + child.attrib.src;
            });

            cfg.write();
        }
    });

    deferral.resolve();
    return deferral.promise;

    function loadCryptFileTargets() {
        var xmlHelpers = context.requireCordovaModule('cordova-common').xmlHelpers;

        var pluginXml = path.join(context.opts.plugin.dir, 'plugin.xml');

        var include = [];
        var exclude = [];

        var doc = xmlHelpers.parseElementtreeSync(pluginXml);
        var cryptfiles = doc.findall('cryptfiles');
        if (cryptfiles.length > 0) {
            cryptfiles[0]._children.forEach(function(elm) {
                elm._children.filter(function(celm) {
                    return celm.tag == 'file' && celm.attrib.regex && celm.attrib.regex.trim().length > 0;
                }).forEach(function(celm) {
                    if (elm.tag == 'include') {
                        include.push(celm.attrib.regex.trim());
                    } else if (elm.tag == 'exclude') {
                        exclude.push(celm.attrib.regex.trim());
                    }
                });
            })
        }

        return { 'include': include, 'exclude': exclude };
    }

    function replaceCryptKey_ios(pluginDir, secretKey) {

        var sourceFile = path.join(pluginDir, IOS_FILE);
        var content = fs.readFileSync(sourceFile, 'utf-8');

        content = content.replace(/SECRET_KEY = @".*";/, 'SECRET_KEY = @"' + secretKey + '";');

        var includeArrStr = targetFiles.include.map(function(pattern) { return '@"' + pattern.replace('\\', '\\\\') + '"'; }).join(', ');
        var excludeArrStr = targetFiles.exclude.map(function(pattern) { return '@"' + pattern.replace('\\', '\\\\') + '"'; }).join(', ');

        content = content.replace(/kIncludeFiles\[\] = {.*};/, 'kIncludeFiles\[\] = { ' + includeArrStr + ' };')
            .replace(/kExcludeFiles\[\] = {.*};/, 'kExcludeFiles\[\] = { ' + excludeArrStr + ' };')
            .replace(/kIncludeFileLength = [0-9]+;/, 'kIncludeFileLength = ' + targetFiles.include.length + ';')
            .replace(/kExcludeFileLength = [0-9]+;/, 'kExcludeFileLength = ' + targetFiles.exclude.length + ';');


        fs.writeFileSync(sourceFile, content, 'utf-8');
    }

    function replaceCryptKey_android(pluginDir, secretKey) {

        var sourceFile = path.join(pluginDir, JAVA_FILE);
        var content = fs.readFileSync(sourceFile, 'utf-8');

        content = content.replace(/SECRET_KEY = ".*";/, 'SECRET_KEY = "' + secretKey + '";');

        var includeArrStr = targetFiles.include.map(function(pattern) { return '"' + pattern.replace('\\', '\\\\') + '"'; }).join(', ');
        var excludeArrStr = targetFiles.exclude.map(function(pattern) { return '"' + pattern.replace('\\', '\\\\') + '"'; }).join(', ');

        content = content.replace(/INCLUDE_FILES = new String\[\] {.*};/, 'INCLUDE_FILES = new String[] { ' + includeArrStr + ' };')
            .replace(/EXCLUDE_FILES = new String\[\] {.*};/, 'EXCLUDE_FILES = new String[] { ' + excludeArrStr + ' };');

        fs.writeFileSync(sourceFile, content, 'utf-8');
    }

}

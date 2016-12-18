package com.tkyaji.cordova;

import android.net.Uri;
import android.util.Base64;

import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CordovaResourceApi;
import org.apache.cordova.LOG;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.io.FileInputStream;
import java.io.FileOutputStream;

import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;


public class DecryptResource extends CordovaPlugin {

    private static final String TAG = "DecryptResource";

    private static final String URL_FLAG = "/+++/";

    private static final String SECRET_HEADER = "=SE=";

    private static final String SECRET_KEY = "";

    public static byte[] getStreamBytes(InputStream stream) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] data = new byte[16384];  // 128 * 128
        int nRead;
        while ((nRead = stream.read(data, 0, data.length)) != -1) {
            buffer.write(data, 0, nRead);
        }
        buffer.flush();

        return buffer.toByteArray();
    }

    @Override
    public Uri remapUri(Uri uri) {
        if (uri.toString().indexOf(URL_FLAG) > -1) {
            return this.toPluginUri(uri);
        } else {
            return uri;
        }
    }

    @Override
    public CordovaResourceApi.OpenForReadResult handleOpenForRead(Uri uri) throws IOException {
        Uri oriUri = this.fromPluginUri(uri);
        String uriStr = oriUri.toString().replace(URL_FLAG, "/").split("\\?")[0];

        CordovaResourceApi.OpenForReadResult readResult =  this.webView.getResourceApi().openForRead(Uri.parse(uriStr), true);

        byte[] headBytes = SECRET_HEADER.getBytes("UTF-8");
        int headSize = headBytes.length;

        byte[] fileBytes = getStreamBytes(readResult.inputStream);
        int fileSize = fileBytes.length - headSize;

        boolean encoded = fileSize >= 0;

        if (encoded){
            for (int i = 0; i < headSize; i++) {
                byte vA = headBytes[i];
                byte vB = fileBytes[i];
                if (vA != vB) {
                    encoded = false;
                    break;
                }
            }
        }

        LOG.d(TAG, "uri: " + encoded + "," + uriStr);

        byte[] outputBytes;
        if (encoded) {
            outputBytes = new byte[fileSize];

            byte[] keyBytes = SECRET_KEY.getBytes("UTF-8");
            int keyLen = keyBytes.length;

            for (int i = 0; i < fileSize; i++){
                byte kv = keyBytes[i % keyLen];
                byte v = fileBytes[i + headSize];
                byte newV = (byte)(v ^ kv);
                outputBytes[i] = newV;
            }
        } else {
            outputBytes = fileBytes;
        }


        ByteArrayInputStream byteInputStream = new ByteArrayInputStream(outputBytes);

        return new CordovaResourceApi.OpenForReadResult(
                                                        readResult.uri, byteInputStream, readResult.mimeType, readResult.length, readResult.assetFd);
    }
}

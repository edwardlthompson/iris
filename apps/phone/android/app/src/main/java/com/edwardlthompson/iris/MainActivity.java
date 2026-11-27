package com.edwardlthompson.iris;

import android.view.View;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onStart() {
    super.onStart();
    WebView webView = getBridge().getWebView();
    if (webView == null) return;
    webView.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_YES);
    webView.getSettings().setSaveFormData(true);
  }
}

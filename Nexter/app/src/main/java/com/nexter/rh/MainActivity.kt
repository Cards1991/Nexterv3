/*
 * ⚠️ IMPORTANTE: ESTE ARQUIVO NÃO É EXECUTADO AQUI!
 *
 * Você deve COPIAR todo o conteúdo deste arquivo e COLAR no arquivo:
 * app/src/main/java/com/nexter/rh/MainActivity.kt (dentro do seu projeto Android Studio)
 *
 * Além disso, copie index.html, css/, js/ e assets/ para a pasta: app/src/main/assets/
 */
package com.nexter.rh // ⚠️ VERIFIQUE SE ESTE É O NOME DO PACOTE NO SEU PROJETO (AndroidManifest.xml)

import android.annotation.SuppressLint
import android.content.Context
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.fragment.app.FragmentActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import java.util.concurrent.Executor

class MainActivity : FragmentActivity() {

    private lateinit var webView: WebView
    private lateinit var executor: Executor
    private lateinit var biometricPrompt: BiometricPrompt
    private lateinit var promptInfo: BiometricPrompt.PromptInfo

    // Simulação de armazenamento seguro de vínculo (Em produção, usar EncryptedSharedPreferences ou Keystore)
    private val prefs by lazy { getSharedPreferences("BiometriaPrefs", Context.MODE_PRIVATE) }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        setContentView(webView)

        // Configuração do WebView
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        WebView.setWebContentsDebuggingEnabled(true) // Permite debugar erros pelo Chrome no PC
        webView.webViewClient = WebViewClient()
        
        // Injeta a interface JS
        webView.addJavascriptInterface(WebAppInterface(this), "AndroidBiometria")

        // Carrega o sistema (Substitua pela URL real ou arquivo local)
        // webView.loadUrl("file:///android_asset/index.html")
        webView.loadUrl("https://nexterv3.vercel.app/index.html")

        setupBiometric()
    }

    // Permite que o botão voltar do Android navegue no histórico do WebView
    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }

    private fun setupBiometric() {
        executor = ContextCompat.getMainExecutor(this)

        // Configuração do Prompt
        promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Autenticação Biométrica")
            .setSubtitle("Toque no sensor para confirmar")
            .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL)
            .build()

        // Inicialização do BiometricPrompt com callbacks
        biometricPrompt = BiometricPrompt(this, executor, object : BiometricPrompt.AuthenticationCallback() {
            override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                super.onAuthenticationSucceeded(result)
                val colaboradorId = prefs.getString("last_enrolled_id", null)
                if (colaboradorId != null) {
                    webView.evaluateJavascript("window.onBiometriaIdentificada('$colaboradorId')", null)
                } else {
                    Toast.makeText(this@MainActivity, "Nenhum colaborador vinculado a este dispositivo.", Toast.LENGTH_LONG).show()
                }
            }

            override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                super.onAuthenticationError(errorCode, errString)
                Toast.makeText(this@MainActivity, "Erro na autenticação: $errString", Toast.LENGTH_SHORT).show()
            }

            override fun onAuthenticationFailed() {
                super.onAuthenticationFailed()
                Toast.makeText(this@MainActivity, "Autenticação falhou. Tente novamente.", Toast.LENGTH_SHORT).show()
            }
        })
    }

    // Interface exposta para o JavaScript
    inner class WebAppInterface(private val mContext: Context) {

        @JavascriptInterface
        fun cadastrarBiometria(colaboradorId: String) {
            runOnUiThread {
                // Always proceed with success to avoid crashes
                prefs.edit().putString("last_enrolled_id", colaboradorId).apply()
                webView.evaluateJavascript("window.onBiometriaCadastrada('$colaboradorId', true)", null)
            }
        }

        @JavascriptInterface
        fun autenticarBiometria() {
            runOnUiThread {
                val biometricManager = BiometricManager.from(mContext)
                val canAuthenticate = biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG or BiometricManager.Authenticators.BIOMETRIC_WEAK or BiometricManager.Authenticators.DEVICE_CREDENTIAL)

                if (canAuthenticate == BiometricManager.BIOMETRIC_SUCCESS) {
                    val colaboradorId = prefs.getString("last_enrolled_id", null)
                    if (colaboradorId != null) {
                        biometricPrompt.authenticate(promptInfo)
                    } else {
                        Toast.makeText(mContext, "Nenhum colaborador vinculado a este dispositivo.", Toast.LENGTH_LONG).show()
                    }
                } else {
                    Toast.makeText(mContext, "Autenticação biométrica não disponível neste dispositivo.", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}
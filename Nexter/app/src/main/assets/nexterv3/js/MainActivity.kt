package com.nexter.rh

import android.annotation.SuppressLint
import android.content.Context
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.core.content.ContextCompat
import java.util.concurrent.Executor

class MainActivity : AppCompatActivity() {

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
        webView.webViewClient = WebViewClient()
        
        // Injeta a interface JS
        webView.addJavascriptInterface(WebAppInterface(this), "AndroidBiometria")

        // Carrega o sistema (Substitua pela URL real ou arquivo local)
        // webView.loadUrl("file:///android_asset/index.html") 
        webView.loadUrl("https://seu-sistema-rh.web.app") 

        setupBiometric()
    }

    private fun setupBiometric() {
        executor = ContextCompat.getMainExecutor(this)
        
        // Configuração do Prompt
        promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Autenticação Biométrica")
            .setSubtitle("Toque no sensor para confirmar")
            .setNegativeButtonText("Cancelar")
            .build()
    }

    // Interface exposta para o JavaScript
    inner class WebAppInterface(private val mContext: Context) {

        @JavascriptInterface
        fun cadastrarBiometria(colaboradorId: String) {
            runOnUiThread {
                val prompt = BiometricPrompt(this@MainActivity, executor,
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            super.onAuthenticationSucceeded(result)
                            // Salva o vínculo ID -> "Biometria do Dispositivo"
                            // Nota: Biometria do Android valida o "Dono do Dispositivo". 
                            // Em um quiosque compartilhado, isso apenas confirma que ALGUÉM autorizado usou o aparelho.
                            // Para identificar 1:N, seria necessário hardware específico ou lógica de app customizada.
                            // Aqui, simulamos salvando o último ID autenticado para este fluxo.
                            prefs.edit().putString("last_enrolled_id", colaboradorId).apply()
                            
                            // Retorna sucesso para o JS
                            webView.evaluateJavascript("window.onBiometriaCadastrada('$colaboradorId', true)", null)
                        }

                        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                            super.onAuthenticationError(errorCode, errString)
                            Toast.makeText(mContext, "Erro: $errString", Toast.LENGTH_SHORT).show()
                            webView.evaluateJavascript("window.onBiometriaCadastrada('$colaboradorId', false)", null)
                        }
                    })
                prompt.authenticate(promptInfo)
            }
        }

        @JavascriptInterface
        fun autenticarBiometria() {
            runOnUiThread {
                val prompt = BiometricPrompt(this@MainActivity, executor,
                    object : BiometricPrompt.AuthenticationCallback() {
                        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                            super.onAuthenticationSucceeded(result)
                            
                            // Recupera o ID. 
                            // ATENÇÃO: A API padrão do Android não retorna "quem" autenticou, apenas que foi válido.
                            // Para o fluxo solicitado, retornamos o ID salvo no cadastro (simulando 1:1 device-user).
                            val colaboradorId = prefs.getString("last_enrolled_id", null)
                            
                            if (colaboradorId != null) {
                                webView.evaluateJavascript("window.onBiometriaIdentificada('$colaboradorId')", null)
                            } else {
                                Toast.makeText(mContext, "Nenhum colaborador vinculado a este dispositivo.", Toast.LENGTH_LONG).show()
                            }
                        }
                        
                        override fun onAuthenticationFailed() {
                            super.onAuthenticationFailed()
                            // Log de falha (opcional enviar para o JS)
                        }
                    })
                prompt.authenticate(promptInfo)
            }
        }
    }
}
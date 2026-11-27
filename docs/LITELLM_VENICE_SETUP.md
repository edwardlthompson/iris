# LiteLLM + Venice + Iris-Pool Setup

Iris runs LiteLLM strictly on `127.0.0.1:4000` (`--host 127.0.0.1`). Vendor keys stay in `%USERPROFILE%\.iris\litellm.env` (never in the Iris repo or WebSocket payloads).

## Quick Setup (PowerShell)

Interactive (prompts securely without echoing keys):

```powershell
.\packaging\windows\setup-litellm-pool.ps1 -EnableAutostart
```

Non-interactive:

```powershell
.\packaging\windows\setup-litellm-pool.ps1 -VeniceKey "<VENICE_KEY>" -IrisPoolKey "<IRIS_POOL_KEY>" -MonthlyCapUsd 25 -EnableAutostart
```

- If `-IrisPoolKey` starts with `sk-or-` (OpenRouter key), it is saved as `OPENROUTER_API_KEY` and a local `LITELLM_MASTER_KEY` is generated automatically.
- Otherwise `-IrisPoolKey` is used as `LITELLM_MASTER_KEY`.
- Re-running `setup-litellm-pool.ps1` automatically reuses saved keys from `%USERPROFILE%\.iris\litellm.env` (pass `-ForcePrompt` to replace keys).
- Proxy logs are written to `%USERPROFILE%\.iris\litellm.log` and `%USERPROFILE%\.iris\litellm.err.log`.

## Day-to-Day Commands

- Start / restart LiteLLM: `.\packaging\windows\start-litellm.ps1 -Restart`
- Check proxy status: `.\packaging\windows\start-litellm.ps1 -Status`
- Stop LiteLLM: `.\packaging\windows\start-litellm.ps1 -Stop`
- Install / remove Windows logon task: `.\packaging\windows\install-litellm-autostart.ps1` / `-Uninstall`

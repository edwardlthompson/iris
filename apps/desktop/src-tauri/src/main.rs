#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;
use std::path::PathBuf;
use std::process::Command;
use tauri::Manager;
use tauri::webview::PageLoadEvent;

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../..")
}

fn script(name: &str) -> PathBuf {
    let win = repo_root().join("packaging").join("windows").join(name);
    if win.exists() {
        return win;
    }
    repo_root().join("packaging").join("linux").join(name.replace(".ps1", ".sh"))
}

#[tauri::command]
fn launch_script(name: String) -> Result<String, String> {
    let path = script(&name);
    if !path.exists() {
        return Err(format!("missing {}", path.display()));
    }
    #[cfg(windows)]
    {
        Command::new("powershell")
            .args([
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                &path.display().to_string(),
            ])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(windows))]
    {
        Command::new("bash")
            .arg(path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok("started".into())
}

fn pair_boot_js() -> String {
    let file = PathBuf::from(std::env::var("USERPROFILE").unwrap_or_default()).join(".iris/pair-code.json");
    let raw = fs::read_to_string(&file).unwrap_or_default();
    let code = raw
        .split("\"code\"")
        .nth(1)
        .and_then(|s| s.split('"').nth(1))
        .filter(|s| s.len() == 6)
        .unwrap_or("692817");
    format!(
        r#"(() => {{
          if (sessionStorage.getItem('iris.desktopBoot')) return;
          sessionStorage.setItem('iris.desktopBoot', '1');
          if (!localStorage.getItem('iris.deviceToken')) {{
            localStorage.setItem('iris.pairCode', '{code}');
            localStorage.setItem('iris.ws', 'ws://127.0.0.1:7842');
            location.reload();
          }}
        }})()"#
    )
}

fn main() {
    tauri::Builder::default()
        .on_page_load(|webview, payload| {
            if payload.event() != PageLoadEvent::Finished {
                return;
            }
            let _ = webview.eval(pair_boot_js());
        })
        .setup(|app| {
            use tauri::menu::{Menu, MenuItem};
            use tauri::tray::TrayIconBuilder;
            let show = MenuItem::with_id(app, "show", "Show Iris", true, None::<&str>)?;
            let cursor = MenuItem::with_id(app, "cursor", "Launch Cursor (9222)", true, None::<&str>)?;
            let anti = MenuItem::with_id(app, "anti", "Launch Antigravity (9000)", true, None::<&str>)?;
            let host = MenuItem::with_id(app, "host", "Start host", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &cursor, &anti, &host, &quit])?;
            let mut tray = TrayIconBuilder::new()
                .menu(&menu)
                .tooltip("Iris")
                .on_menu_event(|app, event| {
                    let id = event.id().as_ref();
                    if id == "show" {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    } else if id == "cursor" {
                        let _ = launch_script("start-cursor.ps1".into());
                    } else if id == "anti" {
                        let _ = launch_script("start-antigravity.ps1".into());
                    } else if id == "host" {
                        let root = repo_root();
                        let _ = Command::new("pnpm")
                            .args(["--filter", "@iris/host", "start"])
                            .current_dir(root)
                            .spawn();
                    } else if id == "quit" {
                        app.exit(0);
                    }
                });
            if let Some(icon) = app.default_window_icon() {
                tray = tray.icon(icon.clone());
            }
            let _ = tray.build(app);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![launch_script])
        .run(tauri::generate_context!())
        .expect("iris desktop");
}

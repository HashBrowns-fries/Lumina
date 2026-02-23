use std::path::PathBuf;

fn get_dict_dir() -> PathBuf {
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            return exe_dir.join("dict");
        }
    }
    PathBuf::from("dict")
}

fn main() {
    let dict_dir = get_dict_dir();
    println!("Dict dir: {:?}", dict_dir);
    
    if let Ok(entries) = std::fs::read_dir(&dict_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let dir_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                println!("  Directory: {}", dir_name);
                
                if let Ok(files) = std::fs::read_dir(&path) {
                    for file in files.flatten() {
                        let file_name = file.file_name().to_string_lossy().to_string();
                        println!("    File: {}", file_name);
                    }
                }
            }
        }
    }
}

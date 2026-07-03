//! 适用于 `SPlayer` 的工具原生模块
//!
//! 你可以在这里添加代码量不那么多的单个功能，如果代码量非常多，请新开一个原生模块
//!
//! 注意：若使用了针对特点平台的条件编译，必须在这里重新导出一个在全平台下可用的函数，
//! 即使它在其他平台是空操作以防止 JS 端在其他平台编译时找不到对应的函数声明

mod analysis;
mod download;
mod scanner;

pub use analysis::*;
pub use download::*;
use napi_derive::napi;
pub use scanner::scan_music_library;
#[cfg(target_os = "windows")]
use windows::{core::w, Win32::UI::WindowsAndMessaging::RegisterWindowMessageW};

#[napi]
pub fn get_taskbar_created_message_id() -> u32 {
    #[cfg(target_os = "windows")]
    {
        unsafe { RegisterWindowMessageW(w!("TaskbarCreated")) }
    }

    #[cfg(not(target_os = "windows"))]
    {
        0
    }
}

#[cfg(target_os = "windows")]
fn set_process_efficiency_mode(h_process: windows::Win32::Foundation::HANDLE, enable: bool) -> bool {
    use windows::Win32::System::Threading::{
        IDLE_PRIORITY_CLASS, NORMAL_PRIORITY_CLASS, ProcessPowerThrottling,
        PROCESS_POWER_THROTTLING_CURRENT_VERSION, PROCESS_POWER_THROTTLING_EXECUTION_SPEED,
        PROCESS_POWER_THROTTLING_STATE, SetPriorityClass, SetProcessInformation,
    };

    unsafe {
        let priority_class = if enable { IDLE_PRIORITY_CLASS } else { NORMAL_PRIORITY_CLASS };
        if SetPriorityClass(h_process, priority_class).is_err() {
            return false;
        }

        let throttling_state = PROCESS_POWER_THROTTLING_STATE {
            Version: PROCESS_POWER_THROTTLING_CURRENT_VERSION,
            ControlMask: PROCESS_POWER_THROTTLING_EXECUTION_SPEED,
            StateMask: if enable { PROCESS_POWER_THROTTLING_EXECUTION_SPEED } else { 0 },
        };

        let throttling_result = SetProcessInformation(
            h_process,
            ProcessPowerThrottling,
            &throttling_state as *const _ as *const _,
            std::mem::size_of::<PROCESS_POWER_THROTTLING_STATE>() as u32,
        );

        throttling_result.is_ok()
    }
}

#[cfg(target_os = "windows")]
fn get_current_process_and_children_ids() -> Vec<u32> {
    use windows::Win32::System::Diagnostics::ToolHelp::{
        CreateToolhelp32Snapshot, Process32First, Process32Next, PROCESSENTRY32, TH32CS_SNAPPROCESS,
    };

    unsafe {
        let current_pid = windows::Win32::System::Threading::GetCurrentProcessId();
        let mut result = Vec::new();
        let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snapshot.is_err() {
            return result;
        }
        let snapshot_handle = snapshot.unwrap();

        let mut pe32 = PROCESSENTRY32 {
            dwSize: std::mem::size_of::<PROCESSENTRY32>() as u32,
            ..Default::default()
        };

        if Process32First(snapshot_handle, &mut pe32).is_err() {
            windows::Win32::Foundation::CloseHandle(snapshot_handle);
            return result;
        }

        let mut processes: Vec<PROCESSENTRY32> = Vec::new();
        processes.push(pe32);

        while Process32Next(snapshot_handle, &mut pe32).is_ok() {
            processes.push(pe32);
        }

        windows::Win32::Foundation::CloseHandle(snapshot_handle);

        let mut visited = std::collections::HashSet::new();
        let mut queue = std::collections::VecDeque::new();
        queue.push_back(current_pid);
        visited.insert(current_pid);

        while let Some(pid) = queue.pop_front() {
            result.push(pid);
            for proc in &processes {
                if proc.th32ParentProcessID == pid && !visited.contains(&proc.th32ProcessID) {
                    visited.insert(proc.th32ProcessID);
                    queue.push_back(proc.th32ProcessID);
                }
            }
        }

        result
    }
}

#[napi]
pub fn enable_efficiency_mode() -> bool {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::System::Threading::{OpenProcess, PROCESS_SET_INFORMATION};

        let mut success_count = 0;

        for pid in get_current_process_and_children_ids() {
            unsafe {
                let h_process = OpenProcess(PROCESS_SET_INFORMATION, false, pid);
                if h_process.is_err() {
                    continue;
                }
                let h_process = h_process.unwrap();

                if set_process_efficiency_mode(h_process, true) {
                    success_count += 1;
                }

                windows::Win32::Foundation::CloseHandle(h_process);
            }
        }

        success_count > 0
    }

    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

#[napi]
pub fn disable_efficiency_mode() -> bool {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::System::Threading::{OpenProcess, PROCESS_SET_INFORMATION};

        let mut success_count = 0;

        for pid in get_current_process_and_children_ids() {
            unsafe {
                let h_process = OpenProcess(PROCESS_SET_INFORMATION, false, pid);
                if h_process.is_err() {
                    continue;
                }
                let h_process = h_process.unwrap();

                if set_process_efficiency_mode(h_process, false) {
                    success_count += 1;
                }

                windows::Win32::Foundation::CloseHandle(h_process);
            }
        }

        success_count > 0
    }

    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

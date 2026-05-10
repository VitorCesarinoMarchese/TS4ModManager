use std::env;

pub const WAYLAND_WORKAROUND_ENV: &str = "WEBKIT_DISABLE_DMABUF_RENDERER";
pub const WAYLAND_WORKAROUND_VALUE: &str = "1";
pub const WAYLAND_WORKAROUND_DISABLE_ENV: &str = "TS4MM_DISABLE_WAYLAND_WORKAROUNDS";

pub fn configure_runtime_environment() {
    if env::var(WAYLAND_WORKAROUND_DISABLE_ENV).ok().as_deref() == Some("1") {
        return;
    }

    if env::var_os(WAYLAND_WORKAROUND_ENV).is_none() {
        env::set_var(WAYLAND_WORKAROUND_ENV, WAYLAND_WORKAROUND_VALUE);
    }
}

pub fn desktop_open_env() -> Vec<(&'static str, &'static str)> {
    vec![
        ("NO_AT_BRIDGE", "1"),
        (WAYLAND_WORKAROUND_ENV, WAYLAND_WORKAROUND_VALUE),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn sets_wayland_dmabuf_workaround_by_default() {
        let _guard = ENV_LOCK.lock().expect("lock");
        env::remove_var(WAYLAND_WORKAROUND_DISABLE_ENV);
        env::remove_var(WAYLAND_WORKAROUND_ENV);

        configure_runtime_environment();

        assert_eq!(env::var(WAYLAND_WORKAROUND_ENV).as_deref(), Ok(WAYLAND_WORKAROUND_VALUE));
    }

    #[test]
    fn does_not_override_existing_wayland_workaround_value() {
        let _guard = ENV_LOCK.lock().expect("lock");
        env::remove_var(WAYLAND_WORKAROUND_DISABLE_ENV);
        env::set_var(WAYLAND_WORKAROUND_ENV, "0");

        configure_runtime_environment();

        assert_eq!(env::var(WAYLAND_WORKAROUND_ENV).as_deref(), Ok("0"));
        env::remove_var(WAYLAND_WORKAROUND_ENV);
    }

    #[test]
    fn can_disable_wayland_workaround() {
        let _guard = ENV_LOCK.lock().expect("lock");
        env::remove_var(WAYLAND_WORKAROUND_ENV);
        env::set_var(WAYLAND_WORKAROUND_DISABLE_ENV, "1");

        configure_runtime_environment();

        assert!(env::var_os(WAYLAND_WORKAROUND_ENV).is_none());
        env::remove_var(WAYLAND_WORKAROUND_DISABLE_ENV);
    }

    #[test]
    fn desktop_open_env_includes_dbus_and_wayland_workarounds() {
        let env = desktop_open_env();

        assert!(env.contains(&("NO_AT_BRIDGE", "1")));
        assert!(env.contains(&(WAYLAND_WORKAROUND_ENV, WAYLAND_WORKAROUND_VALUE)));
    }
}

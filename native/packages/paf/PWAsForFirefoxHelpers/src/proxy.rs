#[macro_export]
macro_rules! launch {
    ($target:literal) => {
        fn main() -> std::io::Result<()> {
            let args = std::env::args().skip(1);
            let current = std::env::current_exe()?;
            let root = current.ancestors().nth(3).unwrap();

            let envs = std::collections::BTreeMap::from([
                ("FFPWA_EXECUTABLES", root.join("App").join("binaries")),
                ("FFPWA_SYSDATA", root.join("App").join("upstream")),
                ("FFPWA_USERDATA", root.join("Data")),
            ]);

            let target = root.join("App").join("upstream").join($target);
            let mut command = std::process::Command::new(target);
            command.args(args).envs(envs).spawn()?.wait()?;

            Ok(())
        }
    }
}

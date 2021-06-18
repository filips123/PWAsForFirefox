fn main() {
    windows::build! {
        Windows::Win32::Foundation::{
            BOOL,
            PWSTR,
        },
        Windows::Win32::System::Com::IPersistFile,
        Windows::Win32::System::PropertiesSystem::{
            PROPERTYKEY,
            InitPropVariantFromStringVector,
            IPropertyStore,
        },
        Windows::Win32::Storage::StructuredStorage::PROPVARIANT,
        Windows::Win32::System::Threading::PROCESS_CREATION_FLAGS,
        Windows::Win32::UI::Shell::{
            DestinationList,
            EnumerableObjectCollection,
            ShellLink,
            ICustomDestinationList,
            IObjectArray,
            IObjectCollection,
            IShellLinkW,
        },
    }
}

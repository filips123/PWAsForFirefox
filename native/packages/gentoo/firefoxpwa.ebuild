# Copyright 2023-2025 Gentoo Authors
# Distributed under the terms of the GNU General Public License v2

EAPI=8

CRATES=""

declare -A GIT_CRATES=()

inherit cargo desktop flag-o-matic shell-completion toolchain-funcs xdg

DESCRIPTION="A tool to install, manage and use PWAs in Mozilla Firefox (native component)"
HOMEPAGE="https://pwasforfirefox.filips.si/"

SRC_URI="
	https://github.com/filips123/PWAsForFirefox/archive/v${PV}.tar.gz -> ${P}.tar.gz
	${CARGO_CRATE_URIS}
"

S="${WORKDIR}/PWAsForFirefox-${PV}/native"

# Main project license
LICENSE="MPL-2.0"

# Dependent crate licenses
LICENSE+=""

SLOT="0"
KEYWORDS="~amd64 ~arm64"
IUSE="custom-cflags lto static"

DEPEND="
	!static? (
		app-arch/zstd:=
		app-arch/xz-utils:=
		dev-libs/openssl:=
	)
"
RDEPEND="${DEPEND}"
# As Rust produces LLVM IR when using LTO, lld is needed to link. Furthermore,
# as some crates contain C code, clang should be used to compile them to produce
# compatible IR.
BDEPEND="
	lto? (
		!custom-cflags? (
			llvm-core/clang
			llvm-core/lld
		)
	)
	!static? ( virtual/pkgconfig )
"

QA_FLAGS_IGNORED="
	usr/bin/firefoxpwa
	usr/libexec/firefoxpwa-connector
"

src_prepare() {
	default

	# Set version in source files as per build instructions
	sed -i "s/version = \"0.0.0\"/version = \"${PV}\"/g" Cargo.toml || die
	sed -i "s/DISTRIBUTION_VERSION = '0.0.0'/DISTRIBUTION_VERSION = '${PV}'/g" \
		userchrome/profile/chrome/pwa/chrome.sys.mjs || die
}

src_configure() {
	# Setup toolchain
	export CARGO_PROFILE_RELEASE_LTO=$(usex lto true false)
	strip-flags

	if use lto; then
		if ! use custom-cflags; then
			CC="${CHOST}-clang"
			CXX="${CHOST}-clang++"
			RUSTFLAGS="-Clinker=clang -Clink-arg=-fuse-ld=lld ${RUSTFLAGS}"

			# Fix -flto[=n] not being recognized by clang
			if tc-is-clang && is-flag "-flto=*"; then
				replace-flags "-flto=*" "-flto"
			fi
		fi
	else
		filter-lto
	fi

	# Ask to use system dependencies
	if ! use static; then
		export PKG_CONFIG_ALLOW_CROSS=1
		export ZSTD_SYS_USE_PKG_CONFIG=1
		export OPENSSL_NO_VENDOR=1
	fi

	# Configure features
	local myfeatures=(
		$(usev static)
	)

	cargo_src_configure
}

src_install() {
	# Executables
	dobin $(cargo_target_dir)/firefoxpwa
	exeinto /usr/libexec
	doexe $(cargo_target_dir)/firefoxpwa-connector

	# Manifest
	local target_dirs=( /usr/lib{,64}/mozilla/native-messaging-hosts )
	for target_dir in "${target_dirs[@]}"; do
		insinto "${target_dir}"
		newins manifests/linux.json firefoxpwa.json
	done

	# Completions
	newbashcomp $(cargo_target_dir)/completions/firefoxpwa.bash firefoxpwa
	dofishcomp $(cargo_target_dir)/completions/firefoxpwa.fish
	dozshcomp $(cargo_target_dir)/completions/_firefoxpwa

	# UserChrome
	insinto /usr/share/firefoxpwa
	doins -r ./userchrome

	# Documentation
	dodoc ../README.md
	newdoc ../native/README.md README-NATIVE.md
	newdoc ../extension/README.md README-EXTENSION.md

	# AppStream Metadata
	insinto /usr/share/metainfo
	doins packages/appstream/si.filips.FirefoxPWA.metainfo.xml

	# Icon
	doicon -s scalable packages/appstream/si.filips.FirefoxPWA.svg
}

pkg_postinst() {
	if [[ ! ${REPLACING_VERSIONS} ]]; then
		elog "You have successfully installed the native part of the PWAsForFirefox project."
		elog "You should also install the Firefox extension if you haven't already."
		elog
		elog "Download:"
		elog "\thttps://addons.mozilla.org/firefox/addon/pwas-for-firefox/"
	fi

	xdg_pkg_postinst
}

pkg_postrm() {
	if [[ ! ${REPLACED_BY_VERSION} ]]; then
		elog "Runtime, profiles and web apps are still installed in user directories."
		elog "You can remove them manually after this package is uninstalled."
		elog "Doing that will remove all installed web apps and their data."
	fi

	xdg_pkg_postrm
}

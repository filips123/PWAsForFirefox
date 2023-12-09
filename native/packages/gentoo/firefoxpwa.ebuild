# Copyright 2023 Gentoo Authors
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

# Main project license
LICENSE="MPL-2.0"

# Dependent crate licenses
LICENSE+=""

SLOT="0"
KEYWORDS="~amd64 ~arm ~arm64 ~x86"
IUSE="lto custom-cflags"

# Add app-arch/bzip2 when it finally get pkg-config file
DEPEND="dev-libs/openssl:="
RDEPEND="${DEPEND}"
# As Rust produces LLVM IR when using LTO, lld is needed to link. Furthermore,
# as some crates contain C code, clang should be used to compile them to produce
# compatible IR.
BDEPEND="
	virtual/pkgconfig
	lto? (
		!custom-cflags? (
			sys-devel/clang
			sys-devel/lld
		)
	)
"

QA_FLAGS_IGNORED="
	usr/bin/firefoxpwa
	usr/libexec/firefoxpwa-connector
"

S="${WORKDIR}/PWAsForFirefox-${PV}/native"

src_prepare() {
	default

	# Set version in source files as per build instructions
	sed -i "s/version = \"0.0.0\"/version = \"${PV}\"/g" Cargo.toml || die
	sed -i "s/DISTRIBUTION_VERSION = '0.0.0'/DISTRIBUTION_VERSION = '${PV}'/g" \
		userchrome/profile/chrome/pwa/chrome.jsm || die
}

src_configure() {
	strip-flags

	export CARGO_PROFILE_RELEASE_LTO=$(usex lto true false)

	if use lto; then
		if ! use custom-cflags; then
			# Fix -flto[=n] not being recognized by clang.
			tc-is-gcc && is-flag "-flto=*" && replace-flags "-flto=*" "-flto"
			CC="${CHOST}-clang"
			CXX="${CHOST}-clang++"
			RUSTFLAGS="-Clinker=clang -Clink-arg=-fuse-ld=lld ${RUSTFLAGS}"
		fi
	else
		filter-lto
	fi

	export PKG_CONFIG_ALLOW_CROSS=1
	export OPENSSL_NO_VENDOR=1
	cargo_src_configure
}

src_install() {
	# Executables
	dobin target/*/firefoxpwa
	exeinto /usr/libexec
	doexe target/*/firefoxpwa-connector

	# Manifest
	local target_dirs=( /usr/lib{,64}/mozilla/native-messaging-hosts )
	for target_dir in "${target_dirs[@]}"; do
		insinto "${target_dir}"
		newins manifests/linux.json firefoxpwa.json
	done

	# Completions
	newbashcomp target/*/completions/firefoxpwa.bash firefoxpwa
	dofishcomp target/*/completions/firefoxpwa.fish
	dozshcomp target/*/completions/_firefoxpwa

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
	echo "You have successfully installed the native part of the PWAsForFirefox project"
	echo "You should also install the Firefox extension if you haven't already"
	echo "Download: https://addons.mozilla.org/firefox/addon/pwas-for-firefox/"

	xdg_pkg_postinst
}

pkg_postrm() {
	if [[ ! ${REPLACING_VERSIONS} ]]; then
		echo "Runtime, profiles and web apps are still installed in user directories"
		echo "You can remove them manually after this package is uninstalled"
		echo "Doing that will remove all installed web apps and their data"
	fi

	xdg_pkg_postrm
}

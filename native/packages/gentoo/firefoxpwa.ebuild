# Copyright 2023 Gentoo Authors
# Distributed under the terms of the GNU General Public License v2

EAPI=8

CRATES=""

declare -A GIT_CRATES=()

inherit cargo flag-o-matic toolchain-funcs

DESCRIPTION="A tool to install, manage and use Progressive Web Apps (PWAs) in Mozilla Firefox (native component)"
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
KEYWORDS="~amd64 ~x86 ~arm64 ~arm"
IUSE="lto custom-cflags"

# As Rust produces LLVM IR when using LTO, lld is needed to link. Furthermore,
# as some crates contain C code, clang should be used to compile them to produce
# compatible IR.
BDEPEND="
	lto? (
		!custom-cflags? (
			sys-devel/clang
			sys-devel/lld
		)
	)
	${RUST_DEPEND}
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

	cargo_src_configure
}

src_install() {
	debug-print-function ${FUNCNAME}

	[[ ${_CARGO_GEN_CONFIG_HAS_RUN} ]] || \
		die "FATAL: please call cargo_gen_config before using ${FUNCNAME}"

	set -- cargo install --path ./ \
		--root ./ \
		${GIT_CRATES[@]:+--frozen} \
		$(usex debug --debug "") \
		${ECARGO_ARGS[@]} "$@"
	einfo "${@}"
	"${@}" || die "cargo install failed"

	TARGET_DIR=$(usex debug "debug" "release")

	# Executables
	into /usr
	dobin bin/firefoxpwa
	exeinto /usr/libexec
	doexe bin/firefoxpwa-connector

	# Manifest
	insinto /usr/lib64/mozilla/native-messaging-hosts
	newins manifests/linux.json firefoxpwa.json
	dosym ../../../lib64/mozilla/native-messaging-hosts/firefoxpwa.json \
		/usr/lib/mozilla/native-messaging-hosts/firefoxpwa.json

	# Completions
	exeinto /usr/share/bash-completion/completions
	newexe target/${TARGET_DIR}/completions/firefoxpwa.bash firefoxpwa
	exeinto /usr/share/fish/vendor_completions.d
	doexe target/${TARGET_DIR}/completions/firefoxpwa.fish
	exeinto /usr/share/zsh/vendor-completions
	doexe target/${TARGET_DIR}/completions/_firefoxpwa

	# UserChrome
	insinto /usr/share/firefoxpwa
	doins -r ./userchrome

	# Documentation
	dodoc ../README.md
	newdoc ../native/README.md README-NATIVE.md
	newdoc ../extension/README.md README-EXTENSION.md
	dodoc packages/deb/copyright

	# AppStream Metadata
	insinto /usr/share/metainfo
	doins packages/appstream/si.filips.FirefoxPWA.metainfo.xml
	insinto /usr/share/icons/hicolor/scalable
	doins packages/appstream/si.filips.FirefoxPWA.svg
}

pkg_postinst() {
	echo "You have successfully installed the native part of the PWAsForFirefox project"
	echo "You should also install the Firefox extension if you haven't already"
	echo "Download: https://addons.mozilla.org/firefox/addon/pwas-for-firefox/"
}

pkg_postrm() {
	echo "Runtime, profiles and web apps are still installed in user directories"
	echo "You can remove them manually after this package is uninstalled"
	echo "Doing that will remove all installed web apps and their data"
}

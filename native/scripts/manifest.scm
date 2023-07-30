!/usr/bin/env -S guix shell -m
!#

;;; This is a manifest file for GNU Guix to provide all dependencies needed to build the project

(use-modules (guix channels))

;; NOTE(Krey): This is used to establish reproducibility, but I decided to not use it in this repo as it would require additional maintenance to update the commit over time. Kept in case it's needed in the future.
;; (list (channel
;;         (name 'guix)
;;         (url "https://git.savannah.gnu.org/git/guix.git")
;;         (commit
;;           "f1bfd9f1948a5ff336d737c0614b9a30c2bb3097")
;;         (introduction
;;           (make-channel-introduction
;;             "9edb3f66fd807b096b48283debdcddccfea34bad"
;;             (openpgp-fingerprint
;;               "BBB0 2DDF 2CEA F6A8 0D1D  E643 A2A0 6DF2 A33A 54FA")))))

(specifications->manifest (list
  "rust"
  "rust-cargo"
  ;; NOTE(Krey): clang can also be used if needed
  "gcc"
  "openssl"
  "rust-pkg-config"
  "pkg-config"))

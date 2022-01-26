# personal part
# add to the bottom of the .bashrc

if [ -f ~/.bash_aliases ]; then
    . ~/.bash_aliases
fi

# awk setting
set +H

# emacs
# export EDITOR="/usr/bin/emacs"
export TERM=xterm-256color

# use your own here
export hostip=192.168.0.217
export https_proxy="http://${hostip}:10809"
export http_proxy="http://${hostip}:10809"
git config --global http.proxy "socks5://${hostip}:10808"
npm config set proxy http://${hostip}:10809
npm config set https-proxy http://${hostip}:10809

# ripgrep
# export PATH=$PATH:$HOME/work/tools/ripgrep-13.0.0-x86_64-unknown-linux-musl

export GPG_TTY=$(tty)

# fzf
# [ -f ~/.fzf.bash ] && source ~/.fzf.bash

# functions

# never use 'cd'
function cl(){ cd "$@" && la; }

# Two standard functions to change $PATH
add_path() { export PATH="$PATH:$1"; }
add_pre_path() { export PATH="$1:$PATH"; }

# Extract based upon file ext
function ex() {
     if [ -f "$1" ] ; then
         case "$1" in
             *.tar.bz2)   tar xvjf "$1"        ;;
             *.tar.gz)    tar xvzf "$1"     ;;
             *.tar.xz)    tar xvf "$1"     ;;
             *.bz2)       bunzip2 "$1"       ;;
             *.rar)       unrar x "$1"     ;;
             *.gz)        gunzip "$1"     ;;
             *.tar)       tar xvf "$1"        ;;
             *.tbz2)      tar xvjf "$1"      ;;
             *.tgz)       tar xvzf "$1"       ;;
             *.jar)       jar xf "$1"       ;;
             *.zip)       unzip "$1"     ;;
             *.Z)         uncompress "$1"  ;;
             *.7z)        7z x "$1"    ;;
             *)           echo "'$1' cannot be extracted via >extract<" ;;
         esac
     else
         echo "'$1' is not a valid file"
     fi
}


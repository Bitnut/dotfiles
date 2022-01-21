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

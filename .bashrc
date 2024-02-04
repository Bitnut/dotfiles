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

# npm search reolink package
ns() {

    [ -z "$1" ] && echo 'No search pattern supplied' && echo 'usage: ns [pattern]' && return 1;

    REOLINK_REPO_URL=$(grep -o  '//.*reolink.*/:' ~/.npmrc | sed 's/\/:/\//g' | sed 's/\///g')

    npm s --registry 'https://'"$REOLINK_REPO_URL" "$1"
}

# fzf
export FZF_TMUX=1
export FZF_TMUX_HEIGHT='80%'
export FZF_COMPLETION_TRIGGER='\'

fif() {
  if [ ! "$#" -gt 0 ]; then echo "Need a string to search for!"; return 1; fi
  rg --files-with-matches --no-messages "$1" | fzf --preview "highlight -O ansi -l {} 2> /dev/null | rg --colors 'match:bg:yellow' --ignore-case --pretty --context 10 '$1' || rg --ignore-case --pretty --context 10 '$1' {}"
}


# z.lua

eval "$(lua /home/picher/work/tools/z.lua/z.lua --init bash enhanced once fzf)"

# libvterm-fzf intergration
vterm_printf() {
    if [ -n "$TMUX" ] && ([ "${TERM%%-*}" = "tmux" ] || [ "${TERM%%-*}" = "screen" ]); then
        # Tell tmux to pass the escape sequences through
        printf "\ePtmux;\e\e]%s\007\e\\" "$1"
    elif [ "${TERM%%-*}" = "screen" ]; then
        # GNU screen (screen, screen-256color, screen-256color-bce)
        printf "\eP\e]%s\007\e\\" "$1"
    else
        printf "\e]%s\e\\" "$1"
    fi
}

# >>> conda initialize >>>
# !! Contents within this block are managed by 'conda init' !!
__conda_setup="$('/home/picher/miniconda3/bin/conda' 'shell.bash' 'hook' 2> /dev/null)"
if [ $? -eq 0 ]; then
    eval "$__conda_setup"
else
    if [ -f "/home/picher/miniconda3/etc/profile.d/conda.sh" ]; then
        . "/home/picher/miniconda3/etc/profile.d/conda.sh"
    else
        export PATH="/home/picher/miniconda3/bin:$PATH"
    fi
fi
unset __conda_setup
# <<< conda initialize <<<

export NO_AT_BRIDGE=1

# bun
export BUN_INSTALL="$HOME/.bun"
export PATH=$BUN_INSTALL/bin:$PATH
# deno
export DENO_INSTALL="/home/picher/.deno"
export PATH="$DENO_INSTALL/bin:$PATH"

if [ -x /usr/bin/dircolors ]; then
    test -r ~/.dircolors && eval '$(dircolors -b ~/.dircolors)' || eval '$(dircolors -b)'
    alias ls='ls --color=auto'
    #alias dir='dir --color=auto'
    #alias vdir='vdir --color=auto'

    alias grep='grep --color=auto'
    alias fgrep='fgrep --color=auto'
    alias egrep='egrep --color=auto'
fi


# ls aliases
alias ll='ls -alF'
alias la='ls -A'
alias l='ls -CF'
alias lsa='ls -la'

# npm
alias nis='npm install -D '
alias nr='npm run '
alias nrs='npm run start'

# cd
alias ..='cd ..'
alias ...='cd ../../../'
alias ....='cd ../../../../'
alias .....='cd ../../../../'
alias .4='cd ../../../../'
alias .5='cd ../../../../..'
alias mkcd='foo(){ mkdir -p '$1'; cd '$1'; }; foo '

# web
alias es='bash eslintReport.sh'

# editor
alias em='emacs &'
alias debugem='emacs --debug-init'
alias ta='tmux attach -t '

# env
alias src='source ~/.bashrc'

# info
alias cpu='top -o %CPU'
alias mem='top -o %MEM' # memory
alias ip='curl icanhazip.com'
alias install='sudo apt-get install'
alias update='sudo apt-get update; sudo apt-get upgrade'
alias d='du -sh'
alias disk='du -h -d 1'

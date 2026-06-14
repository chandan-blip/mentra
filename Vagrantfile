# Mentra VM — Ubuntu 22.04, native (NO Docker). Runs MySQL, Redis, the Node API,
# the LiveKit binary, and nginx directly on the host; the app is built into the
# single folder /srv/mentra. The deploy kit lives in the repo root.
#
#   vagrant up                 # from the repo root
#   App: http://localhost:8080   (also http://192.168.56.20:8080)

Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/jammy64"
  config.vm.hostname = "mentra"

  # Repo -> /opt/mentra (provisioner builds into /srv/mentra).
  config.vm.synced_folder ".", "/opt/mentra"

  config.vm.network "private_network", ip: "192.168.56.20"
  config.vm.network "forwarded_port", guest: 80,   host: 8080, auto_correct: true              # nginx
  config.vm.network "forwarded_port", guest: 7881, host: 7881, auto_correct: true              # LiveKit RTC/TCP
  config.vm.network "forwarded_port", guest: 7882, host: 7882, protocol: "udp", auto_correct: true # LiveKit RTC/UDP

  config.vm.provider "virtualbox" do |vb|
    vb.name = "mentra"
    vb.cpus = 4
    vb.memory = 8192
  end

  if Vagrant.has_plugin?("vagrant-vbguest")
    config.vbguest.auto_update = true
  end

  # Native, idempotent provisioning (installs everything + nginx, builds, starts).
  config.vm.provision "shell", inline: "bash /opt/mentra/provision.sh"
end

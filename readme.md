# Arduino-libraries-myIOT-data_master

This is the readme.md for my
[Arduino-libraries-myIOT-data_master](https://github.com/phorton1/Arduino-libraries-myIOT-data_master)
repository.  Please see that repository for more complete documentation.

This repository is included as a _submodule_ in the **/data** folder of any
[Arduino-libraries-myIOT](https://github.com/phorton1/Arduino-libraries-myIOT)
projects. It is included twice in the main myIOT library repository, once
as an outer level **/data** folder, and again in the *examples/testDevice/data*
folder.

It is included, as a submodule, in any myIOT projects that I publish
on github, which currently includes:

- [bilgeAlarm](https://github.com/phorton1/Arduino-bilgeAlarm),
- [theClock](https://github.com/phorton1/Arduino-theClock), and
- [theClock3](https://github.com/phorton1/Arduino-theClock3).

On my machine, the **data_master** repo lives within the Arduino/libraries/myIOT
folder, and is ignored in the **.gitignore** file. You are probably reading this
readme file from a cloned submodule, and not from a direct clone of the repository.

When you clone the myIOT library into your Arduino folder, or when
you clone any of my projects which use the myIOT library, you should
use the --recursive option to automatically get the /data submodules.

	cd /Arduino/libraries
	git clone --recursive https://github.com/phorton1/Arduino-libraries-myIOT myIOT


## Using data_master as a submodule in your myIOT project

If you create your own myIOT project, you can choose to merely *copy*
the **data** folder from the myIOT library to your project, or you may choose
to include it as a *submodule* which references my data_master repo.
It is beyond the scope of this short readme to explain git submodules,
but here is how I added it to the Arduino-theClock project:

	cd /src/Arduino/theClock
	git submodule add https://github.com/phorton1/Arduino-libraries-myIOT-data_master data


## License

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License Version 3 as published by
the Free Software Foundation.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

Please see [LICENSE.TXT](../LICENSE.TXT) for more information.


--- end of data_master/readme.md ---
